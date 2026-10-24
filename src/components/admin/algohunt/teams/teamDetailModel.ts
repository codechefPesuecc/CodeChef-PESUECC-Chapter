import type { ActivityKind } from "@/server/algohunt/admin/activity";
import type { AdminTeamDetail, TimelineEntry } from "@/server/algohunt/admin/teams";

export type StageActionKind = "COMPLETE_STAGE" | "REVERT_STAGE";

export interface StageAction {
  action: StageActionKind;
  stageNumber: number;
  label: string;
  isFinal: boolean;
}

/**
 * Override buttons per question, only where the engine will accept them (it re-checks and answers
 * CONFLICT otherwise): complete the current question, or revert the latest completed one.
 */
export function stageActions(detail: Pick<AdminTeamDetail, "team" | "progress">): Map<number, StageAction> {
  const actions = new Map<number, StageAction>();
  if (detail.team.status === "DISQUALIFIED" || detail.team.status === "REGISTERED") return actions;

  const { current, stages } = detail.progress;
  if (current) {
    const { stageNumber, isFinal } = current.stage;
    const label = current.progress?.challengeSolved
      ? (isFinal ? "Complete final question" : "Unlock next without a code")
      : "Complete (broken question)";
    actions.set(stageNumber, { action: "COMPLETE_STAGE", stageNumber, label, isFinal });
  }

  const completed = stages.filter((s) => s.progress?.completed);
  const latest = completed.reduce<(typeof completed)[number] | null>(
    (best, s) => (best === null || s.stage.stageNumber > best.stage.stageNumber ? s : best), null,
  );
  if (latest) {
    const { stageNumber, isFinal } = latest.stage;
    actions.set(stageNumber, { action: "REVERT_STAGE", stageNumber, label: "Revert", isFinal });
  }
  return actions;
}

export function revertWarning(isFinal: boolean): string {
  const base = "The code they used is NOT returned.";
  return isFinal ? `${base}\nThe team will have to solve the final question again.` : base;
}

export type TimelineFilter = "all" | "submission" | "code" | "progress" | "admin";

export const TIMELINE_FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "submission", label: "Submissions" },
  { key: "code", label: "Codes" },
  { key: "progress", label: "Progress" },
  { key: "admin", label: "Admin" },
];

export function filterTimeline(entries: readonly TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  return filter === "all" ? [...entries] : entries.filter((entry) => (entry.kind as ActivityKind) === filter);
}

export const DQ_WARNING = "Disqualified teams are removed from the leaderboard and cannot submit or redeem codes.";
