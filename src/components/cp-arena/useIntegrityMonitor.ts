"use client";

import { useCallback, useEffect, useState } from "react";
import { FLAG_LIMIT } from "@/lib/points";

/**
 * Client-side integrity signals for the Arena.
 *
 * These are deterrents, not security — any of them can be bypassed via DevTools
 * or with scripting disabled. Their value is (a) adding friction to casual
 * copy/paste and answer-sharing, and (b) collecting signals that get sent with
 * the submission for server-side review. Real enforcement stays server-side.
 */

// Re-exported so existing importers keep working; defined in lib/points so the
// server can apply the same rule.
export { FLAG_LIMIT };

export type IntegrityEvent =
  | "paste"
  | "copy"
  | "cut"
  | "tab-switch"
  | "context-menu"
  | "screenshot"
  | "window-blur";

const MESSAGES: Record<IntegrityEvent, string> = {
  paste: "Pasting is disabled in the arena.",
  copy: "Copying is disabled during a live solve.",
  cut: "Cutting is disabled in the arena.",
  "tab-switch": "You left the tab — this is recorded for review.",
  "context-menu": "Right-click is disabled in the arena.",
  screenshot: "Screen capture detected — this is recorded for review.",
  "window-blur": "You left the window — this is noted for review.",
};

export interface IntegrityCounts {
  paste: number;
  copy: number;
  cut: number;
  tabSwitch: number;
  contextMenu: number;
  screenshot: number;
  windowBlur: number;
}

const EMPTY: IntegrityCounts = {
  paste: 0,
  copy: 0,
  cut: 0,
  tabSwitch: 0,
  contextMenu: 0,
  screenshot: 0,
  windowBlur: 0,
};

const KEY: Record<IntegrityEvent, keyof IntegrityCounts> = {
  paste: "paste",
  copy: "copy",
  cut: "cut",
  "tab-switch": "tabSwitch",
  "context-menu": "contextMenu",
  screenshot: "screenshot",
  "window-blur": "windowBlur",
};

// Events that count toward the FLAG_LIMIT penalty cap. Window blur is tracked
// for server-side review but is NOT penalised — it conflates innocuous focus
// loss (clicking the address bar, alt-tabbing) with actual screen capture.
const PENALISED: ReadonlySet<IntegrityEvent> = new Set([
  "paste",
  "copy",
  "cut",
  "tab-switch",
  "context-menu",
  "screenshot",
]);

// Merge server counts with the local ones, never dropping below the local value.
// A server sync must never LOWER the shown count — otherwise a flag recorded before
// the ranked attempt row exists (a load-time race, or a slow /api/attempt/start)
// would reconcile the badge straight back to zero.
function mergeMax(local: IntegrityCounts, server: Partial<IntegrityCounts>): IntegrityCounts {
  const out = { ...local };
  (Object.keys(EMPTY) as (keyof IntegrityCounts)[]).forEach((k) => {
    const s = typeof server[k] === "number" ? (server[k] as number) : 0;
    out[k] = Math.max(local[k], s);
  });
  return out;
}

export function useIntegrityMonitor(active: boolean, slug?: string) {
  const [counts, setCounts] = useState<IntegrityCounts>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  // Seed from the server-authoritative count on mount, so a page refresh shows the
  // flags accrued so far instead of resetting to zero.
  useEffect(() => {
    if (!active || !slug) return;
    let alive = true;
    fetch(`/api/attempt/flag?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok && d.counts) setCounts((c) => mergeMax(c, d.counts));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [active, slug]);

  const record = useCallback(
    (event: IntegrityEvent) => {
      // Optimistic local bump for instant feedback…
      setCounts((c) => ({ ...c, [KEY[event]]: c[KEY[event]] + 1 }));
      setNotice(MESSAGES[event]);
      // …then report to the server, which holds the authoritative count (survives a
      // refresh). Reconcile from the response, but never below the local count.
      if (!slug) return;
      fetch("/api/attempt/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, event }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok && d.counts) setCounts((c) => mergeMax(c, d.counts));
        })
        .catch(() => {});
    },
    [slug],
  );

  // Auto-dismiss the transient notice.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(id);
  }, [notice]);

  // Flag leaving the tab/window and likely screen captures during a live solve.
  // A single physical action can fire several events (a tab switch triggers both
  // `visibilitychange` and window `blur`; a snip steals focus and may emit a key
  // event). Coalesce them within a short window so one action is one flag.
  useEffect(() => {
    if (!active) return;
    let lastLeaveAt = 0;
    const leave = (event: IntegrityEvent) => {
      const now = Date.now();
      if (now - lastLeaveAt < 700) return;
      lastLeaveAt = now;
      record(event);
    };

    // Switching to another tab in the same window.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave("tab-switch");
    };

    // Window losing focus while the tab stays visible = an app switch, clicking
    // the address bar, focusing undocked DevTools, etc. Recorded as a distinct
    // "window-blur" signal (not "screenshot") so it doesn't penalise legitimate
    // multitasking.  Deferred a tick so a tab switch — which also blurs — is
    // attributed to visibilitychange above, not double-counted here.
    const onBlur = () => {
      setTimeout(() => {
        if (document.visibilityState === "visible") leave("window-blur");
      }, 0);
    };

    // PrintScreen copies without stealing focus, so it only surfaces via keyup.
    // This is the only event that records as "screenshot".
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") leave("screenshot");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active, record]);

  // Only penalised events count toward the flag cap.
  const total =
    counts.paste +
    counts.copy +
    counts.cut +
    counts.tabSwitch +
    counts.contextMenu +
    counts.screenshot;

  return { counts, notice, total, flagged: total > FLAG_LIMIT, record, PENALISED };
}
