/**
 * AlgoHunt access helpers — local mock until Module 1 lands.
 * Module 1 owns the real implementation; this stub is deleted when M1 merges.
 *
 * Real implementation: src/server/algohunt/access.ts (M1)
 */
import type { AhStage, AhStageProgress } from "@/lib/algohunt/_mock-db-types";
import type { StageState, ErrorCode } from "@/lib/algohunt/types";
import type { TeamContext } from "./teamSession";
import { deriveStageState } from "@/lib/algohunt/stage-state";

export interface StageWithProgress {
  stage: AhStage;
  challengeTitle: string;
  progress: AhStageProgress | null;
  accessible: boolean;
  hasSubmission: boolean;
  state: StageState;
}

export interface TeamProgress {
  stages: StageWithProgress[];
  current: StageWithProgress | null;
  solvedCount: number;
  completedCount: number;
  totalStages: number;
  finished: boolean;
}

export async function getTeamProgress(_ctx: TeamContext): Promise<TeamProgress> {
  // In development, return mock stage 1 progress so the workspace can be rendered
  if (process.env.NODE_ENV === "development") {
    const stage1: AhStage = {
      id: "stage-1",
      eventId: "evt-test-1",
      stageNumber: 1,
      challengeId: "ch-sample-1",
      points: 100,
      isFinal: false,
      enabled: true,
      createdAt: Date.now() - 3600_000,
      updatedAt: Date.now() - 3600_000,
    };
    const current: StageWithProgress = {
      stage: stage1,
      challengeTitle: "Sum of Two Integers",
      progress: {
        id: "sp-1",
        eventId: "evt-test-1",
        teamId: "team-test-1",
        stageId: "stage-1",
        challengeSolved: false,
        challengeSolvedAt: null,
        solvedSubmissionId: null,
        codeRedeemed: false,
        codeRedeemedAt: null,
        redeemedCodeId: null,
        completed: false,
        completedAt: null,
        completionRequestId: null,
        manualOverride: false,
        overrideReason: null,
        overrideBy: null,
        createdAt: Date.now() - 3600_000,
        updatedAt: Date.now() - 3600_000,
      },
      accessible: true,
      hasSubmission: false,
      state: "AVAILABLE",
    };
    return {
      stages: [current],
      current,
      solvedCount: 0,
      completedCount: 0,
      totalStages: 3,
      finished: false,
    };
  }

  // M1 stub: returns empty progress until M1 lands.
  return {
    stages: [],
    current: null,
    solvedCount: 0,
    completedCount: 0,
    totalStages: 0,
    finished: false,
  };
}

/** Returns true if the team can currently access the given stage number. */
export function canAccessStage(progress: TeamProgress, stageNumber: number): boolean {
  return progress.current?.stage.stageNumber === stageNumber;
}

/**
 * Check if a team can perform an action.
 * Returns null when allowed, or an error code + message when not.
 * Order: EVENT_ENDED → EVENT_NOT_LIVE → EVENT_PAUSED → TEAM_DISQUALIFIED
 *        → TEAM_NOT_CHECKED_IN → TEAM_FINISHED → SUBMISSIONS_DISABLED | CODES_DISABLED
 * TODO(M1): Replace with real implementation.
 */
export function assertTeamCanPlay(
  ctx: TeamContext,
  action: "submit" | "run" | "code",
): null | { code: ErrorCode; message: string } {
  const { team, event } = ctx;

  // Event status checks
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return { code: "EVENT_ENDED", message: "AlgoHunt 2.0 has ended. Submissions are closed." };
  }
  if (event.status === "DRAFT" || event.status === "CHECK_IN" || event.status === "READY") {
    return { code: "EVENT_NOT_LIVE", message: "AlgoHunt 2.0 hasn't started yet. Stay close to the Seminar Hall." };
  }
  if (event.status === "PAUSED") {
    return { code: "EVENT_PAUSED", message: "The event is paused. Your progress is safe; please wait for the organizers." };
  }

  // Team status checks
  if (team.status === "DISQUALIFIED") {
    return { code: "TEAM_DISQUALIFIED", message: "Your team has been disqualified. Contact the organizers." };
  }
  if (team.status === "REGISTERED") {
    return { code: "TEAM_NOT_CHECKED_IN", message: "Your team isn't checked in yet. Visit the check-in desk with your team." };
  }
  if (team.status === "FINISHED") {
    return { code: "TEAM_FINISHED", message: "Your team has already finished AlgoHunt 2.0." };
  }

  // Feature flag checks
  if ((action === "submit" || action === "run") && !event.submissionsEnabled) {
    return { code: "SUBMISSIONS_DISABLED", message: "Submissions are temporarily disabled. Please wait." };
  }
  if (action === "code" && !event.codesEnabled) {
    return { code: "CODES_DISABLED", message: "Code redemption is temporarily disabled. Please wait." };
  }

  return null;
}

/** Build a StageWithProgress from its parts. */
export function buildStageWithProgress(
  stage: AhStage,
  challengeTitle: string,
  progress: AhStageProgress | null,
  accessible: boolean,
  hasSubmission: boolean,
): StageWithProgress {
  const state = deriveStageState({
    accessible,
    hasSubmission,
    challengeSolved: progress?.challengeSolved ?? false,
    completed: progress?.completed ?? false,
  });
  return { stage, challengeTitle, progress, accessible, hasSubmission, state };
}
