import { COPY } from "@/lib/algohunt/copy";
import type {
  CurrentStageView, EventStatus, NextStep, ParticipantState, StageSummary, TeamStatus,
} from "@/lib/algohunt/types";
import { getTeamProgress, type StageWithProgress } from "./access";
import { listActiveAnnouncements } from "./announcements";
import type { TeamContext } from "./teamSession";

const NOT_STARTED: readonly EventStatus[] = ["DRAFT", "CHECK_IN", "READY"];

function toStageSummary(row: StageWithProgress): StageSummary {
  return {
    number: row.stage.stageNumber,
    state: row.state,
    isFinal: row.stage.isFinal,
    // Locked questions never reveal their title; completed ones keep it as history.
    title: row.state === "LOCKED" ? null : row.challengeTitle,
    solvedAt: row.progress?.challengeSolvedAt ?? null,
    completedAt: row.progress?.completedAt ?? null,
  };
}

function toCurrentView(row: StageWithProgress): CurrentStageView | null {
  if (row.state === "LOCKED" || row.state === "COMPLETED") return null;
  return {
    number: row.stage.stageNumber,
    isFinal: row.stage.isFinal,
    state: row.state,
    challengeTitle: row.challengeTitle,
    challengeSolved: row.progress?.challengeSolved ?? false,
  };
}

function nextStepFor(
  eventStatus: EventStatus,
  teamStatus: TeamStatus,
  current: CurrentStageView | null,
): NextStep {
  if (teamStatus === "DISQUALIFIED") return { kind: "DISQUALIFIED", message: COPY.disqualified };
  if (teamStatus === "FINISHED") return { kind: "FINISHED", message: COPY.finished };
  if (eventStatus === "ENDED" || eventStatus === "ARCHIVED") return { kind: "ENDED", message: COPY.ended };
  if (teamStatus === "REGISTERED") return { kind: "NOT_CHECKED_IN", message: COPY.notCheckedIn };
  if (NOT_STARTED.includes(eventStatus)) return { kind: "WAIT_FOR_START", message: COPY.notStarted };
  if (eventStatus === "PAUSED") return { kind: "PAUSED", message: COPY.paused };
  if (current?.state === "CODE_PENDING") {
    const n = current.number;
    return {
      kind: "FIND_CODE",
      message: `Question ${n} solved ✓. Find a QR hidden on campus and enter its code to unlock Question ${n + 1}.`,
    };
  }
  if (!current) return { kind: "SOLVE", message: COPY.errors.STAGE_DISABLED };
  return {
    kind: "SOLVE",
    message: current.isFinal
      ? "Solve the FINAL question to finish AlgoHunt 2.0. No code needed."
      : `Solve Question ${current.number}.`,
  };
}

/** The dashboard's whole view of one team. getTeamProgress (≤ 4 queries) + announcements (1 query). */
export async function buildParticipantState(ctx: TeamContext): Promise<ParticipantState> {
  const [progress, announcements] = await Promise.all([
    getTeamProgress(ctx),
    listActiveAnnouncements(ctx.event.id, 5),
  ]);
  const now = Date.now();
  const { event, team } = ctx;
  const eventStatus = event.status as EventStatus;
  const teamStatus = team.status as TeamStatus;

  // No current question before the start, before check-in, after finishing, when DQ, or once the event ended.
  const hidesCurrent =
    NOT_STARTED.includes(eventStatus) || eventStatus === "ENDED" || eventStatus === "ARCHIVED" ||
    teamStatus === "REGISTERED" || teamStatus === "FINISHED" || teamStatus === "DISQUALIFIED";
  const current = !hidesCurrent && progress.current ? toCurrentView(progress.current) : null;

  return {
    serverNow: now,
    event: {
      name: event.name,
      status: eventStatus,
      startedAt: event.startedAt,
      pausedAt: event.pausedAt,
      endedAt: event.endedAt,
      submissionsEnabled: event.submissionsEnabled,
      codesEnabled: event.codesEnabled,
      leaderboardVisible: event.leaderboardVisible,
    },
    team: {
      code: team.teamCode,
      name: team.teamName,
      status: teamStatus,
      finishedAt: team.finishedAt,
      elapsedMs: event.startedAt !== null ? (team.finishedAt ?? now) - event.startedAt : null,
    },
    current,
    stages: progress.stages.map(toStageSummary),
    solvedCount: progress.solvedCount,
    totalStages: progress.totalStages,
    nextStep: nextStepFor(eventStatus, teamStatus, current),
    announcements,
  };
}
