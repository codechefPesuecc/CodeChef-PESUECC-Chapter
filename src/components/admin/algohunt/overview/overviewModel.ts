import type { AdminOverview } from "@/server/algohunt/admin/overview";

export type Tone = "ok" | "warn" | "bad";

/** A team waiting longer than this for a code turns amber on the command center. */
export const STUCK_WARN_MS = 15 * 60_000;

/** "<1m", "14m", "1h 05m". */
export function formatWaiting(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function stuckTone(waitingSinceMs: number): Tone {
  return waitingSinceMs > STUCK_WARN_MS ? "warn" : "ok";
}

export function poolTone(pool: AdminOverview["codePool"]): Tone {
  if (pool.lowPool) return "bad";
  return pool.teamsWaitingForCode > 0 ? "warn" : "ok";
}

export function submissionsTone(counts: AdminOverview["counts"]): Tone {
  return counts.judgeErrors10m > 0 ? "bad" : "ok";
}

export function systemTone(overview: Pick<AdminOverview, "health" | "counts">): Tone {
  if (!overview.health.judge.ok || !overview.health.db.ok) return "bad";
  return overview.counts.judgeErrors10m > 0 ? "warn" : "ok";
}

/** The banner under the cards. Null when nothing needs attention. */
export function lowPoolMessage(pool: AdminOverview["codePool"]): string | null {
  if (!pool.lowPool) return null;
  return `LOW POOL: ${pool.active} active ${pool.active === 1 ? "code" : "codes"}, ${pool.teamsWaitingForCode} ${
    pool.teamsWaitingForCode === 1 ? "team" : "teams"
  } waiting. Generate & print a new batch.`;
}

export const TONE_CLASS: Record<Tone, string> = {
  ok: "text-chocolate",
  warn: "text-amber-700 dark:text-amber-300",
  bad: "text-red-600 dark:text-red-400",
};

/** "01:12:44" since the event started; null before it starts. */
export function formatRunning(startedAt: number | null, now: number): string | null {
  if (startedAt === null) return null;
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
