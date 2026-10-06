"use client";

import { useMemo, useSyncExternalStore } from "react";

/** Per-device id lists in localStorage (dismissed / seen announcements). Never required for correctness. */
const MAX_IDS = 50;
const listeners = new Set<() => void>();

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useStoredIds(key: string): Set<string> {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => "[]");
  return useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
}

export function addStoredIds(key: string, ids: string[]): void {
  try {
    const current = JSON.parse(read(key)) as unknown;
    const list = Array.isArray(current) ? current.filter((id): id is string => typeof id === "string") : [];
    const next = [...list.filter((id) => !ids.includes(id)), ...ids].slice(-MAX_IDS);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the UI just won't remember.
  }
  for (const listener of listeners) listener();
}
