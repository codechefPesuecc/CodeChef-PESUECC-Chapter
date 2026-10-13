import type { TeamStatus } from "@/lib/algohunt/types";
import type { AdminTeamRow } from "@/server/algohunt/admin/teams";

export const TEAM_STATUSES: readonly TeamStatus[] = ["REGISTERED", "CODE_PENDING", "CHECKED_IN", "FINISHED", "DISQUALIFIED"];

export const TEAM_STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  CODE_PENDING: "Code pending",
  CHECKED_IN: "Checked in",
  FINISHED: "Finished",
  DISQUALIFIED: "Disqualified",
};

export const TEAM_STATUS_CLASS: Record<string, string> = {
  CHECKED_IN: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FINISHED: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  DISQUALIFIED: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300",
  CODE_PENDING: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  REGISTERED: "border-hairline bg-hairline/40 text-charcoal/70",
};

export type SortKey =
  | "code" | "name" | "college" | "status" | "currentQuestion" | "questionsSolved"
  | "waiting" | "lastActivityAt" | "checkedInAt" | "finishedAt";
export type SortDir = "asc" | "desc";

/** "just now", "2m ago", "3h ago", "2d ago". */
export function formatAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 30) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "<1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function sortValue(row: AdminTeamRow, key: SortKey, now: number): string | number | null {
  switch (key) {
    case "code": return row.code;
    case "name": return row.name.toLowerCase();
    case "college": return row.college?.toLowerCase() ?? null;
    case "status": return row.status;
    case "currentQuestion": return row.currentQuestion;
    case "questionsSolved": return row.questionsSolved;
    case "waiting": return row.waitingSince === null ? null : now - row.waitingSince;
    case "lastActivityAt": return row.lastActivityAt;
    case "checkedInAt": return row.checkedInAt;
    case "finishedAt": return row.finishedAt;
  }
}

/** Client-side sort. Rows with no value always sort last, in either direction. */
export function sortTeams(rows: readonly AdminTeamRow[], key: SortKey, dir: SortDir, now: number): AdminTeamRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key, now);
    const bv = sortValue(b, key, now);
    if (av === null && bv === null) return a.code.localeCompare(b.code);
    if (av === null) return 1;
    if (bv === null) return -1;
    const order = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return order === 0 ? a.code.localeCompare(b.code) : order * sign;
  });
}

export function filterWaiting(rows: readonly AdminTeamRow[], waitingOnly: boolean): AdminTeamRow[] {
  return waitingOnly ? rows.filter((row) => row.waitingForCode) : [...rows];
}
