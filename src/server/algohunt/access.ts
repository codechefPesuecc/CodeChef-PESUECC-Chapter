import { and, eq } from "drizzle-orm";
import { COPY } from "@/lib/algohunt/copy";
import { deriveStageState } from "@/lib/algohunt/stage-state";
import type { ErrorCode, StageState } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import {
  ahChallenges, ahStageProgress, ahStages, ahSubmissions,
  type AhStage, type AhStageProgress,
} from "@/server/db/schema";
import type { TeamContext } from "./teamSession";

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

export async function getTeamProgress(ctx: TeamContext): Promise<TeamProgress> {
  const db = getDb();
  const [stageRows, progressRows] = await Promise.all([
    db.select({ stage: ahStages, challengeTitle: ahChallenges.title })
      .from(ahStages)
      .innerJoin(ahChallenges, eq(ahStages.challengeId, ahChallenges.id))
      .where(eq(ahStages.eventId, ctx.event.id))
      .orderBy(ahStages.stageNumber),
    db.select().from(ahStageProgress).where(eq(ahStageProgress.teamId, ctx.team.id)),
  ]);
  const byStage = new Map(progressRows.map((row) => [row.stageId, row]));
  const noCurrent =
    ctx.event.startedAt === null ||
    ["DRAFT", "CHECK_IN", "READY"].includes(ctx.event.status) ||
    ctx.team.status === "DISQUALIFIED" ||
    ctx.team.status === "REGISTERED";
  const currentId = noCurrent
    ? null
    : stageRows.find(({ stage }) => !byStage.get(stage.id)?.completed)?.stage.id ?? null;
  let hasCurrentSubmission = false;
  if (currentId) {
    const [submission] = await db.select({ id: ahSubmissions.id }).from(ahSubmissions)
      .where(and(eq(ahSubmissions.teamId, ctx.team.id), eq(ahSubmissions.stageId, currentId)))
      .limit(1);
    hasCurrentSubmission = Boolean(submission);
  }
  const stages = stageRows.map(({ stage, challengeTitle }) => {
    const progress = byStage.get(stage.id) ?? null;
    const accessible = stage.id === currentId;
    const hasSubmission = accessible && hasCurrentSubmission;
    return {
      stage, challengeTitle, progress, accessible, hasSubmission,
      state: deriveStageState({
        accessible, hasSubmission,
        challengeSolved: progress?.challengeSolved ?? false,
        completed: progress?.completed ?? false,
      }),
    };
  });
  return {
    stages,
    current: stages.find(({ stage }) => stage.id === currentId) ?? null,
    solvedCount: progressRows.filter((row) => row.challengeSolved).length,
    completedCount: progressRows.filter((row) => row.completed).length,
    totalStages: stages.length,
    finished: ctx.team.status === "FINISHED",
  };
}

export function canAccessStage(progress: TeamProgress, stageNumber: number): boolean {
  return progress.current?.stage.stageNumber === stageNumber;
}

export function assertTeamCanPlay(
  ctx: TeamContext,
  action: "submit" | "run" | "code",
): null | { code: ErrorCode; message: string } {
  let code: ErrorCode | null = null;
  if (ctx.event.status === "ENDED" || ctx.event.status === "ARCHIVED") code = "EVENT_ENDED";
  else if (["DRAFT", "CHECK_IN", "READY"].includes(ctx.event.status)) code = "EVENT_NOT_LIVE";
  else if (ctx.event.status === "PAUSED") code = "EVENT_PAUSED";
  else if (ctx.team.status === "DISQUALIFIED") code = "TEAM_DISQUALIFIED";
  else if (ctx.team.status === "REGISTERED") code = "TEAM_NOT_CHECKED_IN";
  else if (ctx.team.status === "FINISHED") code = "TEAM_FINISHED";
  else if ((action === "submit" || action === "run") && !ctx.event.submissionsEnabled) code = "SUBMISSIONS_DISABLED";
  else if (action === "code" && !ctx.event.codesEnabled) code = "CODES_DISABLED";
  return code ? { code, message: COPY.errors[code] } : null;
}
