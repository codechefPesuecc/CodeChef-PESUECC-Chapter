"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side integrity signals for the CP Arena.
 *
 * These are deterrents, not security — any of them can be bypassed via DevTools
 * or with scripting disabled. Their value is (a) adding friction to casual
 * copy/paste and answer-sharing, and (b) collecting signals that get sent with
 * the submission for server-side review. Real enforcement stays server-side.
 */

/**
 * Accumulating MORE than this many flags removes a solver from the day's top 10
 * — an accepted solve then earns only the 100-point base instead of the speed
 * bounty.
 */
export const FLAG_LIMIT = 5;

export type IntegrityEvent =
  | "paste"
  | "copy"
  | "cut"
  | "tab-switch"
  | "context-menu";

const MESSAGES: Record<IntegrityEvent, string> = {
  paste: "Pasting is disabled in the arena.",
  copy: "Copying is disabled during a live solve.",
  cut: "Cutting is disabled in the arena.",
  "tab-switch": "You left the tab — this is recorded for review.",
  "context-menu": "Right-click is disabled in the arena.",
};

export interface IntegrityCounts {
  paste: number;
  copy: number;
  cut: number;
  tabSwitch: number;
  contextMenu: number;
}

const EMPTY: IntegrityCounts = {
  paste: 0,
  copy: 0,
  cut: 0,
  tabSwitch: 0,
  contextMenu: 0,
};

const KEY: Record<IntegrityEvent, keyof IntegrityCounts> = {
  paste: "paste",
  copy: "copy",
  cut: "cut",
  "tab-switch": "tabSwitch",
  "context-menu": "contextMenu",
};

export function useIntegrityMonitor(active: boolean) {
  const [counts, setCounts] = useState<IntegrityCounts>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  const record = useCallback((event: IntegrityEvent) => {
    setCounts((c) => ({ ...c, [KEY[event]]: c[KEY[event]] + 1 }));
    setNotice(MESSAGES[event]);
  }, []);

  // Auto-dismiss the transient notice.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(id);
  }, [notice]);

  // Flag leaving the tab/window while a solve is still in progress.
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        record("tab-switch");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, record]);

  const total =
    counts.paste +
    counts.copy +
    counts.cut +
    counts.tabSwitch +
    counts.contextMenu;

  return { counts, notice, total, flagged: total > FLAG_LIMIT, record };
}
