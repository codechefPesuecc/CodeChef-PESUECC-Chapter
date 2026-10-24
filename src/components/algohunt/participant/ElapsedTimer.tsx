"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/algohunt/format";

/**
 * Display-only elapsed clock. offset = serverNow − Date.now() is re-taken on every poll,
 * so the phone's own clock never matters. Frozen at elapsedMs once the team has finished.
 */
export default function ElapsedTimer({
  startedAt,
  serverNow,
  frozenMs,
}: {
  startedAt: number | null;
  serverNow: number;
  frozenMs: number | null;
}) {
  const [elapsed, setElapsed] = useState(() => (startedAt === null ? null : serverNow - startedAt));

  useEffect(() => {
    if (startedAt === null || frozenMs !== null) return;
    const offset = serverNow - Date.now();
    const id = setInterval(() => setElapsed(Date.now() + offset - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt, serverNow, frozenMs]);

  const value = frozenMs ?? elapsed;
  if (value === null) return null;
  return <span className="font-mono tabular-nums">{formatDuration(value)}</span>;
}
