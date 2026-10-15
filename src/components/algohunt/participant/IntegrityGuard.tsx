"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, ShieldAlert } from "lucide-react";
import type { AwayReason } from "@/lib/algohunt/types";
import { useParticipantState } from "./ParticipantStateProvider";
import { useEventClock } from "./useEventClock";

// Laptops only, while the team can play: keeps AlgoHunt in full screen and records time spent away
// (left full screen, switched tab or app, focused another window) for the organizers. Phones are
// never asked, since teams solve and enter codes on laptops. Nothing here blocks play or
// disqualifies anyone; it is a visible deterrent plus a record admins review.

/** Ignore flickers shorter than this (a permission prompt, a fast Alt-Tab back). */
const LEAVE_DELAY_MS = 1500;
/** Time to press "Enter full screen" after the page loads or play resumes, before it counts. */
const ENTRY_GRACE_MS = 20_000;
/** An episode still open when the page reloads or unmounts is closed by the next page. */
const OPEN_EPISODE_KEY = "ah:away-episode";

interface Episode {
  reasons: Set<AwayReason>;
  timer: ReturnType<typeof setTimeout> | null;
  leave: Promise<string | null> | null;
}

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
};

function isLaptop(): boolean {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return false;
  // iPadOS asks for the desktop site and reports itself as a Mac.
  return !(/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function fullscreenSupported(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

function inFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

function awayReasons(needsFullscreen: boolean): AwayReason[] {
  const reasons: AwayReason[] = [];
  if (needsFullscreen && !inFullscreen()) reasons.push("FULLSCREEN");
  if (document.visibilityState === "hidden") reasons.push("HIDDEN");
  if (!document.hasFocus()) reasons.push("BLUR");
  return reasons;
}

async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else await el.webkitRequestFullscreen?.();
    // Chrome and Edge: a stray Esc (closing editor suggestions) no longer drops full screen.
    // Holding Esc still exits, and that is recorded like any other exit.
    const keyboard = (navigator as Navigator & { keyboard?: { lock?: (keys?: string[]) => Promise<void> } }).keyboard;
    await keyboard?.lock?.(["Escape"]);
  } catch {
    // Refused or unsupported: the overlay stays up and they can try again.
  }
}

async function report(body: { action: "leave"; reasons: AwayReason[] } | { action: "return"; id: string }) {
  try {
    const response = await fetch("/api/algohunt/integrity", {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as { ok: boolean; recorded?: boolean; id?: string; awayMs?: number | null };
  } catch {
    return null;
  }
}

function readOpenEpisode(): string | null {
  try {
    return sessionStorage.getItem(OPEN_EPISODE_KEY);
  } catch {
    return null;
  }
}

function writeOpenEpisode(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(OPEN_EPISODE_KEY, id);
    else sessionStorage.removeItem(OPEN_EPISODE_KEY);
  } catch {
    // Storage off: an episode left open by a reload just shows as "no return recorded".
  }
}

function formatAway(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export default function IntegrityGuard() {
  const { state, refresh } = useParticipantState();
  const { timeUp } = useEventClock();
  const watching = state.event.status === "LIVE" && state.team.status === "CHECKED_IN" && !timeUp;

  const [laptop, setLaptop] = useState(false);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const episode = useRef<Episode | null>(null);
  const graceUntil = useRef(0);

  // Device checks need the browser; run them once after mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setLaptop(isLaptop());
      setNeedsFullscreen(isLaptop() && fullscreenSupported());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const active = watching && laptop;

  const sendLeave = useCallback((ep: Episode) => {
    ep.timer = null;
    ep.leave = report({ action: "leave", reasons: [...ep.reasons] }).then((res) => {
      if (!res?.recorded || !res.id) return null;
      writeOpenEpisode(res.id);
      refresh();
      return res.id;
    });
  }, [refresh]);

  const closeEpisode = useCallback((showNotice: boolean) => {
    const ep = episode.current;
    episode.current = null;
    if (!ep) return;
    if (ep.timer) {
      clearTimeout(ep.timer); // never reported, so nothing to close
      return;
    }
    void ep.leave?.then(async (id) => {
      if (!id) return;
      writeOpenEpisode(null);
      const res = await report({ action: "return", id });
      // Quote the server's recorded time, so the team hears exactly what organizers see.
      if (showNotice && typeof res?.awayMs === "number") {
        setNotice(`You were away from AlgoHunt for ${formatAway(res.awayMs)}. That adds an integrity flag for your team.`);
      }
    });
  }, []);

  const evaluate = useCallback(() => {
    if (!active) return;
    const reasons = awayReasons(needsFullscreen);
    setShowOverlay(needsFullscreen && !inFullscreen());
    if (reasons.length === 0) {
      if (episode.current) {
        closeEpisode(true);
        return;
      }
      // Back in a good state: close anything a previous page (a reload) left open.
      const stale = readOpenEpisode();
      if (stale) {
        writeOpenEpisode(null);
        void report({ action: "return", id: stale });
      }
      return;
    }
    const ep = episode.current;
    if (ep) {
      reasons.forEach((reason) => ep.reasons.add(reason));
      return;
    }
    const now = Date.now();
    const delay = Math.max(LEAVE_DELAY_MS, graceUntil.current - now);
    const next: Episode = { reasons: new Set(reasons), timer: null, leave: null };
    next.timer = setTimeout(() => sendLeave(next), delay);
    episode.current = next;
  }, [active, needsFullscreen, closeEpisode, sendLeave]);

  useEffect(() => {
    if (!active) {
      // Paused, ended, time up or finished: stop counting. Nothing open is reported as away.
      closeEpisode(false);
      const raf = requestAnimationFrame(() => setShowOverlay(false));
      return () => cancelAnimationFrame(raf);
    }
    graceUntil.current = Date.now() + ENTRY_GRACE_MS;
    const raf = requestAnimationFrame(evaluate);
    const events = ["visibilitychange", "fullscreenchange", "webkitfullscreenchange"] as const;
    events.forEach((name) => document.addEventListener(name, evaluate));
    window.addEventListener("blur", evaluate);
    window.addEventListener("focus", evaluate);
    // No report on pagehide: real exits are reported by their 1.5 s timer while the page is alive,
    // and a reload or a closed tab during the entry grace must not turn into a flag.
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((name) => document.removeEventListener(name, evaluate));
      window.removeEventListener("blur", evaluate);
      window.removeEventListener("focus", evaluate);
    };
  }, [active, evaluate, closeEpisode]);

  // Leaving the team pages (a soft navigation) drops a not-yet-reported episode instead of letting
  // its timer fire later on another page. An already reported one stays open until a page closes it.
  useEffect(() => () => {
    const ep = episode.current;
    if (ep?.timer) clearTimeout(ep.timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  if (!active) return null;

  return (
    <>
      {showOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ah-fullscreen-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-bronze/40 bg-panel p-6 text-center shadow-2xl">
            <Maximize aria-hidden className="mx-auto h-10 w-10 text-bronze" />
            <h2 id="ah-fullscreen-title" className="font-display text-xl font-bold text-chocolate dark:text-cream">
              AlgoHunt runs in full screen
            </h2>
            <p className="text-sm text-charcoal/80">
              Leaving full screen, switching tabs or opening other apps on this laptop adds an integrity flag. Every
              team&apos;s flags show on the leaderboard.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => void enterFullscreen()}
              className="mecha-btn mecha-btn--solid w-full justify-center py-3 text-base"
            >
              <Maximize aria-hidden className="h-4 w-4" />
              Enter full screen
            </button>
            {state.integrity.awayCount > 0 && (
              <p className="text-xs text-charcoal/60">Integrity flags for your team so far: {state.integrity.awayCount}</p>
            )}
          </div>
        </div>
      )}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-3 z-[999] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-lg dark:bg-amber-950 dark:text-amber-100"
        >
          <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
    </>
  );
}
