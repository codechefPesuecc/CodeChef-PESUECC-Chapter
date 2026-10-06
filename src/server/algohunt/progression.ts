import crypto from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { ErrorCode } from "@/lib/algohunt/types";
import { getDb, type AppDatabase } from "@/server/db";
import {
  ahAuditLogs, ahCodes, ahDisqualifications, ahEvents, ahStageProgress, ahStages, ahTeams,
} from "@/server/db/schema";
import { getTeamProgress } from "./access";
import type { TeamContext } from "./teamSession";

function conditionalAudit(
  db: AppDatabase,
  entry: {
    eventId: string;
    teamId: string | null;
    actorType: "SYSTEM" | "ADMIN";
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | SQL;
    metadata: SQL;
    ip?: string;
    now: number;
    condition: SQL;
  },
) {
  return db.insert(ahAuditLogs).select(sql`
    SELECT ${crypto.randomUUID()}, ${entry.eventId}, ${entry.teamId}, ${entry.actorType},
      ${entry.actorId}, ${entry.action}, ${entry.targetType}, ${entry.targetId},
      ${entry.metadata}, ${entry.ip ?? null}, NULL, ${entry.now}
    WHERE ${entry.condition}
  `);
}

function completedFinal(teamId: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ah_stage_progress p JOIN ah_stages s ON s.id = p.stage_id
    WHERE p.team_id = ${teamId} AND s.is_final = 1 AND p.completed = 1
  )`;
}

export async function recordChallengeSolved(p: {
  ctx: TeamContext;
  stageId: string;
  submissionId: string;
}): Promise<{ alreadySolved: boolean; finished: boolean }> {
  const db = getDb();
  const now = Date.now();
  const reqId = crypto.randomUUID();
  const teamId = p.ctx.team.id;
  const eventId = p.ctx.event.id;
  const stageId = p.stageId;
  const submissionId = p.submissionId;
  const stageNumber = sql`(SELECT stage_number FROM ah_stages WHERE id = ${stageId})`;
  const [solved, , finished] = await db.batch([
    db.insert(ahStageProgress).values({
      id: crypto.randomUUID(), eventId, teamId, stageId,
      challengeSolved: true, challengeSolvedAt: now, solvedSubmissionId: submissionId,
      createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [ahStageProgress.teamId, ahStageProgress.stageId],
      set: {
        challengeSolved: true, challengeSolvedAt: now,
        solvedSubmissionId: submissionId, updatedAt: now,
      },
      setWhere: eq(ahStageProgress.challengeSolved, false),
    }).returning({ id: ahStageProgress.id }),
    db.update(ahStageProgress).set({
      completed: true, completedAt: now, completionRequestId: reqId, updatedAt: now,
    }).where(and(
      eq(ahStageProgress.teamId, teamId), eq(ahStageProgress.stageId, stageId),
      eq(ahStageProgress.challengeSolved, true), eq(ahStageProgress.completed, false),
      sql`EXISTS (SELECT 1 FROM ah_stages WHERE id = ${stageId} AND is_final = 1)`,
    )).returning({ id: ahStageProgress.id }),
    db.update(ahTeams).set({ status: "FINISHED", finishedAt: now, updatedAt: now })
      .where(and(
        eq(ahTeams.id, teamId), eq(ahTeams.status, "CHECKED_IN"),
        sql`${ahTeams.finishedAt} IS NULL`, completedFinal(teamId),
      )).returning({ id: ahTeams.id }),
    conditionalAudit(db, {
      eventId, teamId, actorType: "SYSTEM", actorId: null,
      action: "stage.solved", targetType: "stage", targetId: stageId,
      metadata: sql`json_object('stageNumber', ${stageNumber}, 'submissionId', ${submissionId})`,
      now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${teamId}
        AND stage_id = ${stageId} AND solved_submission_id = ${submissionId})`,
    }),
    conditionalAudit(db, {
      eventId, teamId, actorType: "SYSTEM", actorId: null,
      action: "stage.completed", targetType: "stage", targetId: stageId,
      metadata: sql`json_object('stageNumber', ${stageNumber}, 'via', 'FINAL_SOLVE')`,
      now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${teamId}
        AND stage_id = ${stageId} AND completion_request_id = ${reqId})`,
    }),
    conditionalAudit(db, {
      eventId, teamId, actorType: "SYSTEM", actorId: null,
      action: "team.finished", targetType: "team", targetId: teamId,
      metadata: sql`json_object('stageNumber', ${stageNumber})`, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_teams WHERE id = ${teamId} AND finished_at = ${now})`,
    }),
  ]);
  return { alreadySolved: solved.length === 0, finished: finished.length === 1 };
}

export async function redeemCode(p: {
  ctx: TeamContext;
  stageId: string;
  code: string;
  ip?: string;
}): Promise<{
  outcome: "UNLOCKED" | "ALREADY_UNLOCKED" | "ALREADY_USED" | "INVALID" | "NOT_SOLVED";
  codeId: string | null;
}> {
  const db = getDb();
  const now = Date.now();
  const reqId = crypto.randomUUID();
  const teamId = p.ctx.team.id;
  const eventId = p.ctx.event.id;
  const stageId = p.stageId;
  const code = p.code;
  const stageNumber = sql`(SELECT stage_number FROM ah_stages WHERE id = ${stageId})`;
  const codeSerial = sql`(SELECT serial FROM ah_codes WHERE code = ${code})`;
  // D1 serializes batches. The first of two teams to update one ACTIVE code wins;
  // the other sees USED. For one team with two codes, the first batch completes
  // the question, so the second cannot consume its code. A repeated code also
  // sees the completed question. S1 and S2 therefore change together or not at all.
  const [consumed] = await db.batch([
    db.update(ahCodes).set({
      status: "USED", usedByTeamId: teamId, usedAfterStageId: stageId, usedAt: now,
    }).where(and(
      eq(ahCodes.eventId, eventId), eq(ahCodes.code, code), eq(ahCodes.status, "ACTIVE"),
      sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${teamId}
        AND stage_id = ${stageId} AND challenge_solved = 1 AND completed = 0)`,
      sql`EXISTS (SELECT 1 FROM ah_stages WHERE id = ${stageId}
        AND event_id = ${eventId} AND is_final = 0)`,
    )).returning({ id: ahCodes.id }),
    db.update(ahStageProgress).set({
      codeRedeemed: true, codeRedeemedAt: now,
      redeemedCodeId: sql`(SELECT id FROM ah_codes WHERE code = ${code}
        AND used_by_team_id = ${teamId} AND used_at = ${now})`,
      completed: true, completedAt: now, completionRequestId: reqId, updatedAt: now,
    }).where(and(
      eq(ahStageProgress.teamId, teamId), eq(ahStageProgress.stageId, stageId),
      eq(ahStageProgress.completed, false),
      sql`EXISTS (SELECT 1 FROM ah_codes WHERE code = ${code}
        AND used_by_team_id = ${teamId} AND used_after_stage_id = ${stageId} AND used_at = ${now})`,
    )).returning({ id: ahStageProgress.id }),
    conditionalAudit(db, {
      eventId, teamId, actorType: "SYSTEM", actorId: null,
      action: "code.redeemed", targetType: "code",
      targetId: sql`(SELECT id FROM ah_codes WHERE code = ${code})`,
      metadata: sql`json_object('stageNumber', ${stageNumber}, 'codeSerial', ${codeSerial})`,
      ip: p.ip, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${teamId}
        AND stage_id = ${stageId} AND completion_request_id = ${reqId})`,
    }),
    conditionalAudit(db, {
      eventId, teamId, actorType: "SYSTEM", actorId: null,
      action: "stage.completed", targetType: "stage", targetId: stageId,
      metadata: sql`json_object('stageNumber', ${stageNumber}, 'via', 'CODE', 'codeSerial', ${codeSerial})`,
      now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${teamId}
        AND stage_id = ${stageId} AND completion_request_id = ${reqId})`,
    }),
  ]);
  if (consumed.length === 1) return { outcome: "UNLOCKED", codeId: consumed[0].id };

  // Classify only after checking the team's solve, so an unsolved team cannot
  // probe whether a code exists or has already been used.
  const [progress] = await db.select({
    challengeSolved: ahStageProgress.challengeSolved,
    completed: ahStageProgress.completed,
    isFinal: ahStages.isFinal,
  }).from(ahStageProgress).innerJoin(ahStages, eq(ahStageProgress.stageId, ahStages.id))
    .where(and(eq(ahStageProgress.teamId, teamId), eq(ahStageProgress.stageId, stageId)))
    .limit(1);
  if (!progress?.challengeSolved) return { outcome: "NOT_SOLVED", codeId: null };
  if (progress.completed || progress.isFinal) return { outcome: "ALREADY_UNLOCKED", codeId: null };
  const [codeRow] = await db.select({ status: ahCodes.status }).from(ahCodes)
    .where(and(eq(ahCodes.eventId, eventId), eq(ahCodes.code, code))).limit(1);
  if (!codeRow || codeRow.status === "DISABLED") return { outcome: "INVALID", codeId: null };
  if (codeRow.status === "USED") return { outcome: "ALREADY_USED", codeId: null };
  console.error("[algohunt:progression] active code could not be redeemed", { eventId, teamId, stageId });
  return { outcome: "INVALID", codeId: null };
}

async function adminTeamContext(eventId: string, teamId: string): Promise<TeamContext | null> {
  const [row] = await getDb().select({ team: ahTeams, event: ahEvents }).from(ahTeams)
    .innerJoin(ahEvents, eq(ahTeams.eventId, ahEvents.id))
    .where(and(eq(ahTeams.id, teamId), eq(ahEvents.id, eventId))).limit(1);
  return row ?? null;
}

export async function adminCompleteStage(p: {
  eventId: string;
  teamId: string;
  stageId: string;
  adminId: string;
  reason: string;
  ip?: string;
}): Promise<
  { ok: true; changed: boolean; finished: boolean } |
  { ok: false; code: ErrorCode; message: string }
> {
  const ctx = await adminTeamContext(p.eventId, p.teamId);
  if (!ctx) return { ok: false, code: "NOT_FOUND", message: "Team not found in this event." };
  const progress = await getTeamProgress(ctx);
  const stage = progress.stages.find((row) => row.stage.id === p.stageId);
  if (!stage) return { ok: false, code: "NOT_FOUND", message: "Question not found in this event." };
  if (progress.current?.stage.id !== p.stageId) {
    return {
      ok: false, code: "CONFLICT",
      message: `You can only unlock from the team's current question (Question ${progress.current?.stage.stageNumber ?? stage.stage.stageNumber}).`,
    };
  }
  const db = getDb();
  const now = Date.now();
  const reqId = crypto.randomUUID();
  const stageNumber = stage.stage.stageNumber;
  const [changed, finished] = await db.batch([
    db.insert(ahStageProgress).values({
      id: crypto.randomUUID(), eventId: p.eventId, teamId: p.teamId, stageId: p.stageId,
      completed: true, completedAt: now, completionRequestId: reqId,
      manualOverride: true, overrideReason: p.reason, overrideBy: p.adminId,
      createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [ahStageProgress.teamId, ahStageProgress.stageId],
      set: {
        completed: true, completedAt: now, completionRequestId: reqId,
        manualOverride: true, overrideReason: p.reason, overrideBy: p.adminId,
        updatedAt: now,
      },
      setWhere: eq(ahStageProgress.completed, false),
    }).returning({ id: ahStageProgress.id }),
    db.update(ahTeams).set({ status: "FINISHED", finishedAt: now, updatedAt: now })
      .where(and(
        eq(ahTeams.id, p.teamId), eq(ahTeams.status, "CHECKED_IN"),
        sql`${ahTeams.finishedAt} IS NULL`, completedFinal(p.teamId),
      )).returning({ id: ahTeams.id }),
    conditionalAudit(db, {
      eventId: p.eventId, teamId: p.teamId, actorType: "ADMIN", actorId: p.adminId,
      action: "override.complete_stage", targetType: "stage", targetId: p.stageId,
      metadata: sql`json_object('stageNumber', ${stageNumber}, 'reason', ${p.reason})`,
      ip: p.ip, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${p.teamId}
        AND stage_id = ${p.stageId} AND completion_request_id = ${reqId})`,
    }),
    conditionalAudit(db, {
      eventId: p.eventId, teamId: p.teamId, actorType: "SYSTEM", actorId: null,
      action: "stage.completed", targetType: "stage", targetId: p.stageId,
      metadata: sql`json_object('stageNumber', ${stageNumber}, 'via', 'OVERRIDE')`, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${p.teamId}
        AND stage_id = ${p.stageId} AND completion_request_id = ${reqId})`,
    }),
    conditionalAudit(db, {
      eventId: p.eventId, teamId: p.teamId, actorType: "SYSTEM", actorId: null,
      action: "team.finished", targetType: "team", targetId: p.teamId,
      metadata: sql`json_object('stageNumber', ${stageNumber})`, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_teams WHERE id = ${p.teamId} AND finished_at = ${now})`,
    }),
  ]);
  return { ok: true, changed: changed.length === 1, finished: finished.length === 1 };
}

export async function adminRevertStage(p: {
  eventId: string;
  teamId: string;
  stageId: string;
  adminId: string;
  reason: string;
  ip?: string;
}): Promise<{ ok: true; changed: boolean } | { ok: false; code: ErrorCode; message: string }> {
  const ctx = await adminTeamContext(p.eventId, p.teamId);
  if (!ctx) return { ok: false, code: "NOT_FOUND", message: "Team not found in this event." };
  const progress = await getTeamProgress(ctx);
  const stage = progress.stages.find((row) => row.stage.id === p.stageId);
  if (!stage) return { ok: false, code: "NOT_FOUND", message: "Question not found in this event." };
  const latest = [...progress.stages].reverse().find((row) => row.progress?.completed);
  if (latest?.stage.id !== p.stageId) {
    return {
      ok: false, code: "CONFLICT",
      message: `You can only revert the team's latest completed question (Question ${latest?.stage.stageNumber ?? stage.stage.stageNumber}).`,
    };
  }
  const db = getDb();
  const now = Date.now();
  const reqId = crypto.randomUUID();
  // A non-final revert keeps the Accepted solve and the used code, returning
  // the team to CODE_PENDING. A final revert clears the solve so it can be
  // accepted again; codes are never returned to the pool in either case.
  const [changed] = await db.batch([
    db.update(ahStageProgress).set({
      completed: false, completedAt: null, completionRequestId: reqId,
      challengeSolved: sql`CASE WHEN EXISTS (SELECT 1 FROM ah_stages WHERE id = ${p.stageId} AND is_final = 1)
        THEN 0 ELSE ${ahStageProgress.challengeSolved} END`,
      challengeSolvedAt: sql`CASE WHEN EXISTS (SELECT 1 FROM ah_stages WHERE id = ${p.stageId} AND is_final = 1)
        THEN NULL ELSE ${ahStageProgress.challengeSolvedAt} END`,
      solvedSubmissionId: sql`CASE WHEN EXISTS (SELECT 1 FROM ah_stages WHERE id = ${p.stageId} AND is_final = 1)
        THEN NULL ELSE ${ahStageProgress.solvedSubmissionId} END`,
      manualOverride: true, overrideReason: p.reason, overrideBy: p.adminId, updatedAt: now,
    }).where(and(
      eq(ahStageProgress.teamId, p.teamId), eq(ahStageProgress.stageId, p.stageId),
      eq(ahStageProgress.completed, true),
    )).returning({ id: ahStageProgress.id }),
    db.update(ahTeams).set({ status: "CHECKED_IN", finishedAt: null, updatedAt: now })
      .where(and(
        eq(ahTeams.id, p.teamId), eq(ahTeams.status, "FINISHED"),
        sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${p.teamId}
          AND completion_request_id = ${reqId} AND completed = 0)`,
      )),
    conditionalAudit(db, {
      eventId: p.eventId, teamId: p.teamId, actorType: "ADMIN", actorId: p.adminId,
      action: "override.revert_stage", targetType: "stage", targetId: p.stageId,
      metadata: sql`json_object('stageNumber', ${stage.stage.stageNumber}, 'reason', ${p.reason})`,
      ip: p.ip, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_stage_progress WHERE team_id = ${p.teamId}
        AND stage_id = ${p.stageId} AND completion_request_id = ${reqId} AND completed = 0)`,
    }),
  ]);
  return { ok: true, changed: changed.length === 1 };
}

export async function disqualifyTeam(p: {
  eventId: string;
  teamId: string;
  adminId: string;
  reason: string;
  ip?: string;
}): Promise<{ changed: boolean }> {
  const db = getDb();
  const now = Date.now();
  const [changed] = await db.batch([
    db.update(ahTeams).set({
      status: "DISQUALIFIED", disqualifiedAt: now,
      disqualificationReason: p.reason, updatedAt: now,
    }).where(and(
      eq(ahTeams.id, p.teamId), eq(ahTeams.eventId, p.eventId),
      sql`${ahTeams.status} != 'DISQUALIFIED'`,
    )).returning({ id: ahTeams.id }),
    db.insert(ahDisqualifications).select(sql`
      SELECT ${crypto.randomUUID()}, ${p.eventId}, ${p.teamId}, ${p.reason}, ${p.adminId}, ${now},
        NULL, NULL, NULL
      WHERE EXISTS (SELECT 1 FROM ah_teams WHERE id = ${p.teamId}
        AND event_id = ${p.eventId} AND disqualified_at = ${now})
    `),
    conditionalAudit(db, {
      eventId: p.eventId, teamId: p.teamId, actorType: "ADMIN", actorId: p.adminId,
      action: "team.disqualified", targetType: "team", targetId: p.teamId,
      metadata: sql`json_object('reason', ${p.reason})`, ip: p.ip, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_teams WHERE id = ${p.teamId}
        AND event_id = ${p.eventId} AND disqualified_at = ${now})`,
    }),
  ]);
  return { changed: changed.length === 1 };
}

export async function reinstateTeam(p: {
  eventId: string;
  teamId: string;
  adminId: string;
  reason: string;
  ip?: string;
}): Promise<{ changed: boolean }> {
  const db = getDb();
  const now = Date.now();
  const [changed] = await db.batch([
    db.update(ahTeams).set({
      status: sql`CASE WHEN ${ahTeams.finishedAt} IS NOT NULL THEN 'FINISHED'
        WHEN ${ahTeams.checkedInAt} IS NOT NULL THEN 'CHECKED_IN' ELSE 'REGISTERED' END`,
      disqualifiedAt: null, disqualificationReason: null, updatedAt: now,
    }).where(and(
      eq(ahTeams.id, p.teamId), eq(ahTeams.eventId, p.eventId),
      eq(ahTeams.status, "DISQUALIFIED"),
    )).returning({ id: ahTeams.id }),
    db.update(ahDisqualifications).set({
      revokedAt: now, revokedBy: p.adminId, revokeReason: p.reason,
    }).where(and(
      sql`${ahDisqualifications.id} = (
        SELECT id FROM ah_disqualifications WHERE event_id = ${p.eventId}
          AND team_id = ${p.teamId} AND revoked_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      )`,
      sql`EXISTS (SELECT 1 FROM ah_teams WHERE id = ${p.teamId}
        AND event_id = ${p.eventId} AND updated_at = ${now} AND status != 'DISQUALIFIED')`,
    )),
    conditionalAudit(db, {
      eventId: p.eventId, teamId: p.teamId, actorType: "ADMIN", actorId: p.adminId,
      action: "team.reinstated", targetType: "team", targetId: p.teamId,
      metadata: sql`json_object('reason', ${p.reason}, 'restoredStatus',
        (SELECT status FROM ah_teams WHERE id = ${p.teamId}))`,
      ip: p.ip, now,
      condition: sql`EXISTS (SELECT 1 FROM ah_teams WHERE id = ${p.teamId}
        AND event_id = ${p.eventId} AND updated_at = ${now} AND status != 'DISQUALIFIED')`,
    }),
  ]);
  return { changed: changed.length === 1 };
}
