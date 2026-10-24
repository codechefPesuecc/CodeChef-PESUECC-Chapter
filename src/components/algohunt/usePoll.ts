"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  lastUpdated: number | null;
  online: boolean;
  refresh: () => void;
}

const MIN_DELAY_MS = 1000;
const MAX_BACKOFF_FACTOR = 4;
const REQUEST_TIMEOUT_MS = 15_000;
/** Consecutive network failures (thrown fetch / timeout) before reporting offline. */
const OFFLINE_AFTER_FAILURES = 2;

const NETWORK_ERROR = "Can't reach the server. Check your connection; we'll keep retrying.";
const TIMEOUT_ERROR = "The server took too long to respond. We'll keep retrying.";
const BAD_RESPONSE_ERROR = "Unexpected response from the server. We'll keep retrying.";

/**
 * Delay before the next poll: exponential backoff on consecutive failures,
 * capped at 4x the interval, plus symmetric jitter, never below 1000ms.
 */
export function nextDelay(
  intervalMs: number,
  jitterMs: number,
  consecutiveFailures: number,
  rand: () => number = Math.random,
): number {
  const failures = Math.max(0, consecutiveFailures);
  const base = Math.min(intervalMs * 2 ** failures, intervalMs * MAX_BACKOFF_FACTOR);
  const jitter = (rand() * 2 - 1) * jitterMs;
  return Math.max(MIN_DELAY_MS, base + jitter);
}

type Snapshot<T> = Omit<PollState<T>, "refresh"> & { url: string };

function initialSnapshot<T>(url: string): Snapshot<T> {
  return { url, data: null, error: null, loading: false, lastUpdated: null, online: true };
}

interface Poller {
  refresh: () => void;
  stop: () => void;
}

/**
 * One polling lifecycle for a single URL. Framework-free so the hook stays a thin
 * wrapper; every state change goes through `emit`, which is silenced after stop().
 */
function startPoller<T>(
  url: string,
  intervalMs: number,
  jitterMs: number,
  emit: (patch: Partial<Snapshot<T>>) => void,
): Poller {
  let stopped = false;
  let inFlight = false;
  let refreshQueued = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let failures = 0;
  let networkFailures = 0;

  const isHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule() {
    clearTimer();
    if (stopped || isHidden()) return;
    timer = setTimeout(tick, nextDelay(intervalMs, jitterMs, failures));
  }

  async function tick() {
    timer = null;
    if (stopped || inFlight) return;
    inFlight = true;
    const ctrl = new AbortController();
    controller = ctrl;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, REQUEST_TIMEOUT_MS);
    emit({ loading: true });

    let patch: Partial<Snapshot<T>>;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // Not JSON (e.g. a proxy error page). The server still answered, so we are online.
      }
      if (stopped) return;
      // Any HTTP response, including 429 and other non-2xx, proves the network is up.
      networkFailures = 0;
      const envelope = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
      if (res.ok && envelope?.ok === true) {
        failures = 0;
        const data: Record<string, unknown> = { ...envelope };
        delete data.ok;
        patch = { data: data as T, error: null, lastUpdated: Date.now(), online: true };
      } else {
        // ok:false, non-2xx (429 included) or unparseable: back off, keep last good data.
        failures += 1;
        const message = typeof envelope?.error === "string" ? envelope.error : BAD_RESPONSE_ERROR;
        patch = { error: message, online: true };
      }
    } catch {
      if (stopped) return;
      failures += 1;
      networkFailures += 1;
      patch = { error: timedOut ? TIMEOUT_ERROR : NETWORK_ERROR };
      if (networkFailures >= OFFLINE_AFTER_FAILURES) patch.online = false;
    } finally {
      clearTimeout(timeout);
      inFlight = false;
      if (controller === ctrl) controller = null;
    }

    emit({ ...patch, loading: false });
    if (refreshQueued) {
      refreshQueued = false;
      void tick();
    } else {
      schedule();
    }
  }

  function refresh() {
    if (stopped) return;
    clearTimer();
    if (inFlight) {
      // Never run two requests at once; fetch again as soon as the current one settles.
      refreshQueued = true;
      return;
    }
    void tick();
  }

  function onVisibilityChange() {
    if (isHidden()) clearTimer();
    else refresh();
  }

  function onOnline() {
    refresh();
  }

  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
  if (typeof window !== "undefined") window.addEventListener("online", onOnline);

  if (!isHidden()) void tick();

  return {
    refresh,
    stop() {
      stopped = true;
      clearTimer();
      controller?.abort();
      controller = null;
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    },
  };
}

/**
 * Poll a JSON endpoint that returns the AlgoHunt envelope ({ ok: true, ...data } or
 * { ok: false, error, code }). `data` is the envelope without `ok`. `loading` is true
 * while a request is in flight. Polling pauses while the tab is hidden and resumes
 * with an immediate fetch when it becomes visible or the browser comes back online.
 */
export function usePoll<T>(
  url: string,
  opts: {
    intervalMs: number;
    enabled?: boolean;
    jitterMs?: number;
  },
): PollState<T> {
  const { intervalMs, enabled = true, jitterMs = 0 } = opts;
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => initialSnapshot<T>(url));
  const pollerRef = useRef<Poller | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const poller = startPoller<T>(url, intervalMs, jitterMs, (patch) => {
      setSnapshot((prev) => ({ ...(prev.url === url ? prev : initialSnapshot<T>(url)), ...patch }));
    });
    pollerRef.current = poller;
    return () => {
      poller.stop();
      if (pollerRef.current === poller) pollerRef.current = null;
    };
  }, [url, intervalMs, jitterMs, enabled]);

  const refresh = useCallback(() => {
    pollerRef.current?.refresh();
  }, []);

  // Never surface results that belong to a previous URL.
  const current = snapshot.url === url ? snapshot : initialSnapshot<T>(url);
  return {
    data: current.data,
    error: current.error,
    loading: enabled && current.loading,
    lastUpdated: current.lastUpdated,
    online: current.online,
    refresh,
  };
}
