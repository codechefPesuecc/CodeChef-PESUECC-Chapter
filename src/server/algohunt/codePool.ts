import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, like, or, sql } from "drizzle-orm";
import { alreadyUnlockedMessage, codeUnlockedMessage, cooldownMessage, COPY } from "@/lib/algohunt/copy";
import { generateCode, isWellFormedCode, normalizeCode } from "@/lib/algohunt/codes";
import type {
  CodeAttemptResult,
  CodePoolStats,
  CodeStatus,
  ErrorCode,
  RedeemResult,
} from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import {
  ahCodeAttempts,
  ahCodeBatches,
  ahCodes,
  ahEvents,
  ahStageProgress,
  ahStages,
  ahTeams,
  type AhCodeBatch,
} from "@/server/db/schema";
import { assertTeamCanPlay, getTeamProgress } from "./access";
import { auditInsert, writeAudit } from "./audit";
import { redeemCode } from "./progression";
import type { TeamContext } from "./teamSession";

export async function createCodeBatch(p: {
  eventId: string;
  name: string;
  size: number;
  adminId: string;
}): Promise<
  | { ok: true; batch: AhCodeBatch; codes: { serial: number; code: string }[] }
  | { ok: false; code: ErrorCode; message: string }
> {
  const db = getDb();
  if (p.size < 1 || p.size > 200 || !Number.isInteger(p.size)) {
    return { ok: false, code: "VALIDATION", message: COPY.errors.VALIDATION };
  }
  const name = p.name ? p.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return { ok: false, code: "VALIDATION", message: COPY.errors.VALIDATION };
  }

  const [event] = await db.select().from(ahEvents).where(eq(ahEvents.id, p.eventId)).limit(1);
  if (!event) {
    return { ok: false, code: "NOT_FOUND", message: COPY.errors.NOT_FOUND };
  }
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return { ok: false, code: "EVENT_ENDED", message: COPY.errors.EVENT_ENDED };
  }

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    const [maxRow] = await db
      .select({ maxSerial: sql<number>`COALESCE(MAX(${ahCodes.serial}), 0)` })
      .from(ahCodes)
      .where(eq(ahCodes.eventId, p.eventId));

    const startSerial = (maxRow?.maxSerial ?? 0) + 1;
    const batchId = crypto.randomUUID();
    const now = Date.now();

    const codeSet = new Set<string>();
    while (codeSet.size < p.size) {
      codeSet.add(generateCode());
    }
    const generatedList = Array.from(codeSet);

    const codeRows = generatedList.map((code, idx) => ({
      id: crypto.randomUUID(),
      eventId: p.eventId,
      batchId,
      serial: startSerial + idx,
      code,
      status: "ACTIVE" as const,
      createdAt: now,
    }));

    const CHUNK_SIZE = 14;
    const chunks: typeof codeRows[] = [];
    for (let i = 0; i < codeRows.length; i += CHUNK_SIZE) {
      chunks.push(codeRows.slice(i, i + CHUNK_SIZE));
    }

    const batchRow: AhCodeBatch = {
      id: batchId,
      eventId: p.eventId,
      name,
      size: p.size,
      createdBy: p.adminId,
      createdAt: now,
    };

    try {
      await db.batch([
        db.insert(ahCodeBatches).values(batchRow),
        ...chunks.map((chunk) => db.insert(ahCodes).values(chunk)),
        auditInsert(db, {
          eventId: p.eventId,
          teamId: null,
          actorType: "ADMIN",
          actorId: p.adminId,
          action: "code.batch_created",
          targetType: "batch",
          targetId: batchId,
          metadata: {
            name,
            size: p.size,
            serialFrom: startSerial,
            serialTo: startSerial + p.size - 1,
          },
        }),
      ]);

      return {
        ok: true,
        batch: batchRow,
        codes: codeRows.map((c) => ({ serial: c.serial, code: c.code })),
      };
    } catch {
      if (attempt === 2) {
        return { ok: false, code: "CONFLICT", message: "Please try again." };
      }
    }
  }

  return { ok: false, code: "CONFLICT", message: "Please try again." };
}

export async function redeemCodeForTeam(p: {
  ctx: TeamContext;
  rawCode: string;
  ip: string;
}): Promise<
  | { ok: true; result: RedeemResult }
  | { ok: false; code: ErrorCode; message?: string; retryAfterSeconds?: number }
> {
  const block = assertTeamCanPlay(p.ctx, "code");
  if (block) {
    return { ok: false, code: block.code, message: block.message };
  }

  const code = normalizeCode(p.rawCode);
  const now = Date.now();
  const db = getDb();

  // 3. Cooldown check
  const invalidAttempts = await db
    .select({ createdAt: ahCodeAttempts.createdAt })
    .from(ahCodeAttempts)
    .where(
      and(
        eq(ahCodeAttempts.teamId, p.ctx.team.id),
        eq(ahCodeAttempts.result, "INVALID"),
        gt(ahCodeAttempts.createdAt, now - 600000),
      ),
    )
    .orderBy(desc(ahCodeAttempts.createdAt))
    .limit(5);

  if (invalidAttempts.length === 5) {
    const fifthOldest = invalidAttempts[4].createdAt;
    const retry = Math.ceil((fifthOldest + 600000 - now) / 1000);
    if (retry > 0) {
      await db.insert(ahCodeAttempts).values({
        id: crypto.randomUUID(),
        eventId: p.ctx.event.id,
        teamId: p.ctx.team.id,
        stageId: null,
        submittedCode: code,
        result: "COOLDOWN",
        codeId: null,
        ip: p.ip,
        createdAt: now,
      });
      return {
        ok: false,
        code: "COOLDOWN",
        message: cooldownMessage(retry),
        retryAfterSeconds: retry,
      };
    }
  }

  // 4. Progress check
  const progress = await getTeamProgress(p.ctx);
  const cur = progress.current;
  if (!cur) {
    const [teamRow] = await db
      .select({ status: ahTeams.status })
      .from(ahTeams)
      .where(eq(ahTeams.id, p.ctx.team.id))
      .limit(1);
    if (progress.finished || p.ctx.team.status === "FINISHED" || teamRow?.status === "FINISHED") {
      return { ok: false, code: "TEAM_FINISHED", message: COPY.errors.TEAM_FINISHED };
    }
    return { ok: false, code: "EVENT_NOT_LIVE", message: COPY.errors.EVENT_NOT_LIVE };
  }
  const n = cur.stage.stageNumber;

  // 6. cur.stage.isFinal check
  if (cur.stage.isFinal) {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId: cur.stage.id,
      submittedCode: code,
      result: "NOT_SOLVED",
      codeId: null,
      ip: p.ip,
      createdAt: now,
    });
    return {
      ok: false,
      code: "CHALLENGE_NOT_SOLVED",
      message: "The final question needs no code. Solve it to finish AlgoHunt 2.0!",
    };
  }

  // 5. Just moved on check
  const prevStage = n > 1 ? progress.stages.find((s) => s.stage.stageNumber === n - 1) : null;
  const prevRedeemedAt = prevStage?.progress?.codeRedeemedAt;
  if (!cur.progress?.challengeSolved && prevRedeemedAt && prevRedeemedAt > now - 60000) {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId: cur.stage.id,
      submittedCode: code,
      result: "ALREADY_UNLOCKED",
      codeId: null,
      ip: p.ip,
      createdAt: now,
    });
    return {
      ok: true,
      result: {
        result: "ALREADY_UNLOCKED",
        message: alreadyUnlockedMessage(n),
        unlockedStageNumber: n,
        invalidAttemptsLeft: null,
      },
    };
  }

  // 7. Not solved yet
  if (!cur.progress?.challengeSolved) {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId: cur.stage.id,
      submittedCode: code,
      result: "NOT_SOLVED",
      codeId: null,
      ip: p.ip,
      createdAt: now,
    });
    return {
      ok: false,
      code: "CHALLENGE_NOT_SOLVED",
      message: COPY.notSolved,
    };
  }

  async function handleInvalidAttempt(stageId: string) {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId,
      submittedCode: code,
      result: "INVALID",
      codeId: null,
      ip: p.ip,
      createdAt: now,
    });

    const invalidCountInWindowIncludingThis = invalidAttempts.length + 1;
    const invalidAttemptsLeft = Math.max(0, 5 - invalidCountInWindowIncludingThis);

    if (invalidCountInWindowIncludingThis === 5) {
      await writeAudit({
        eventId: p.ctx.event.id,
        teamId: p.ctx.team.id,
        actorType: "TEAM",
        actorId: p.ctx.team.id,
        action: "code.attempt_suspicious",
        targetType: "team",
        targetId: p.ctx.team.id,
        metadata: { invalidIn10m: 5 },
        ip: p.ip,
      });
    }

    return {
      ok: true as const,
      result: {
        result: "INVALID" as const,
        message: COPY.invalidCode,
        unlockedStageNumber: null,
        invalidAttemptsLeft,
      },
    };
  }

  // 8. !isWellFormedCode check
  if (!isWellFormedCode(code)) {
    return await handleInvalidAttempt(cur.stage.id);
  }

  // 9. Atomic redeem call
  const r = await redeemCode({ ctx: p.ctx, stageId: cur.stage.id, code, ip: p.ip });

  if (r.outcome === "UNLOCKED") {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId: cur.stage.id,
      submittedCode: code,
      result: "UNLOCKED",
      codeId: r.codeId,
      ip: p.ip,
      createdAt: now,
    });
    return {
      ok: true,
      result: {
        result: "UNLOCKED",
        message: codeUnlockedMessage(n + 1),
        unlockedStageNumber: n + 1,
        invalidAttemptsLeft: null,
      },
    };
  }

  if (r.outcome === "ALREADY_UNLOCKED") {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId: cur.stage.id,
      submittedCode: code,
      result: "ALREADY_UNLOCKED",
      codeId: null,
      ip: p.ip,
      createdAt: now,
    });
    return {
      ok: true,
      result: {
        result: "ALREADY_UNLOCKED",
        message: alreadyUnlockedMessage(n + 1),
        unlockedStageNumber: n + 1,
        invalidAttemptsLeft: null,
      },
    };
  }

  if (r.outcome === "ALREADY_USED") {
    await db.insert(ahCodeAttempts).values({
      id: crypto.randomUUID(),
      eventId: p.ctx.event.id,
      teamId: p.ctx.team.id,
      stageId: cur.stage.id,
      submittedCode: code,
      result: "ALREADY_USED",
      codeId: null,
      ip: p.ip,
      createdAt: now,
    });
    return {
      ok: true,
      result: {
        result: "ALREADY_USED",
        message: COPY.alreadyUsed,
        unlockedStageNumber: null,
        invalidAttemptsLeft: null,
      },
    };
  }

  if (r.outcome === "INVALID") {
    return await handleInvalidAttempt(cur.stage.id);
  }

  // NOT_SOLVED (race condition)
  await db.insert(ahCodeAttempts).values({
    id: crypto.randomUUID(),
    eventId: p.ctx.event.id,
    teamId: p.ctx.team.id,
    stageId: cur.stage.id,
    submittedCode: code,
    result: "NOT_SOLVED",
    codeId: null,
    ip: p.ip,
    createdAt: now,
  });
  return {
    ok: false,
    code: "CHALLENGE_NOT_SOLVED",
    message: COPY.notSolved,
  };
}

export async function getCodePoolStats(eventId: string): Promise<CodePoolStats> {
  const db = getDb();
  const now = Date.now();

  const [statusCounts, waitingRow, recentRow] = await Promise.all([
    db
      .select({
        status: ahCodes.status,
        count: sql<number>`count(*)`,
      })
      .from(ahCodes)
      .where(eq(ahCodes.eventId, eventId))
      .groupBy(ahCodes.status),

    db
      .select({
        count: sql<number>`count(distinct ${ahStageProgress.teamId})`,
      })
      .from(ahStageProgress)
      .innerJoin(ahStages, eq(ahStageProgress.stageId, ahStages.id))
      .innerJoin(ahTeams, eq(ahStageProgress.teamId, ahTeams.id))
      .where(
        and(
          eq(ahStageProgress.eventId, eventId),
          eq(ahStageProgress.challengeSolved, true),
          eq(ahStageProgress.completed, false),
          eq(ahStages.isFinal, false),
          eq(ahTeams.status, "CHECKED_IN"),
        ),
      ),

    db
      .select({
        lastRedeemedAt: sql<number | null>`max(${ahCodes.usedAt})`,
        redeemedLast10m: sql<number>`count(case when ${ahCodes.status} = 'USED' and ${ahCodes.usedAt} > ${now - 600000} then 1 end)`,
      })
      .from(ahCodes)
      .where(eq(ahCodes.eventId, eventId)),
  ]);

  let active = 0;
  let used = 0;
  let disabled = 0;

  for (const row of statusCounts) {
    if (row.status === "ACTIVE") active = row.count;
    else if (row.status === "USED") used = row.count;
    else if (row.status === "DISABLED") disabled = row.count;
  }

  const total = active + used + disabled;
  const teamsWaitingForCode = waitingRow[0]?.count ?? 0;
  const lastRedeemedAt = recentRow[0]?.lastRedeemedAt ?? null;
  const redeemedLast10m = recentRow[0]?.redeemedLast10m ?? 0;

  return {
    total,
    active,
    used,
    disabled,
    teamsWaitingForCode,
    lastRedeemedAt,
    redeemedLast10m,
  };
}

export async function listCodes(p: {
  eventId: string;
  status?: CodeStatus;
  batchId?: string;
  q?: string;
  cursor?: number;
  limit?: number;
}): Promise<{
  codes: {
    id: string;
    serial: number;
    code: string;
    batchName: string;
    status: CodeStatus;
    usedByTeam: { code: string; name: string } | null;
    usedForStageNumber: number | null;
    usedAt: number | null;
    disabledReason: string | null;
    placementNote: string | null;
  }[];
  nextCursor: number | null;
}> {
  const db = getDb();
  const limit = Math.min(Math.max(p.limit ?? 50, 1), 100);

  const conditions = [eq(ahCodes.eventId, p.eventId)];
  if (p.status) {
    conditions.push(eq(ahCodes.status, p.status));
  }
  if (p.batchId) {
    conditions.push(eq(ahCodes.batchId, p.batchId));
  }
  if (p.cursor !== undefined) {
    conditions.push(gt(ahCodes.serial, p.cursor));
  }

  if (p.q && p.q.trim().length > 0) {
    const q = p.q.trim();
    const asNum = parseInt(q, 10);
    if (!Number.isNaN(asNum) && String(asNum) === q) {
      conditions.push(
        or(
          eq(ahCodes.serial, asNum),
          like(ahCodes.code, `%${q}%`),
          like(ahTeams.teamCode, `%${q}%`),
        )!,
      );
    } else {
      conditions.push(
        or(
          like(ahCodes.code, `%${q.toUpperCase()}%`),
          like(ahTeams.teamCode, `%${q}%`),
          like(ahTeams.teamName, `%${q}%`),
        )!,
      );
    }
  }

  const rows = await db
    .select({
      id: ahCodes.id,
      serial: ahCodes.serial,
      code: ahCodes.code,
      batchName: ahCodeBatches.name,
      status: ahCodes.status,
      usedByTeamCode: ahTeams.teamCode,
      usedByTeamName: ahTeams.teamName,
      usedForStageNumber: ahStages.stageNumber,
      usedAt: ahCodes.usedAt,
      disabledReason: ahCodes.disabledReason,
      placementNote: ahCodes.placementNote,
    })
    .from(ahCodes)
    .innerJoin(ahCodeBatches, eq(ahCodes.batchId, ahCodeBatches.id))
    .leftJoin(ahTeams, eq(ahCodes.usedByTeamId, ahTeams.id))
    .leftJoin(ahStages, eq(ahCodes.usedAfterStageId, ahStages.id))
    .where(and(...conditions))
    .orderBy(ahCodes.serial)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].serial : null;

  return {
    codes: sliced.map((r) => ({
      id: r.id,
      serial: r.serial,
      code: r.code,
      batchName: r.batchName,
      status: r.status as CodeStatus,
      usedByTeam:
        r.usedByTeamCode && r.usedByTeamName
          ? { code: r.usedByTeamCode, name: r.usedByTeamName }
          : null,
      usedForStageNumber: r.usedForStageNumber ?? null,
      usedAt: r.usedAt ?? null,
      disabledReason: r.disabledReason ?? null,
      placementNote: r.placementNote ?? null,
    })),
    nextCursor,
  };
}

export async function listBatches(eventId: string): Promise<
  {
    id: string;
    name: string;
    size: number;
    createdAt: number;
    active: number;
    used: number;
    disabled: number;
  }[]
> {
  const db = getDb();
  const rows = await db
    .select({
      id: ahCodeBatches.id,
      name: ahCodeBatches.name,
      size: ahCodeBatches.size,
      createdAt: ahCodeBatches.createdAt,
      active: sql<number>`count(case when ${ahCodes.status} = 'ACTIVE' then 1 end)`,
      used: sql<number>`count(case when ${ahCodes.status} = 'USED' then 1 end)`,
      disabled: sql<number>`count(case when ${ahCodes.status} = 'DISABLED' then 1 end)`,
    })
    .from(ahCodeBatches)
    .leftJoin(ahCodes, eq(ahCodeBatches.id, ahCodes.batchId))
    .where(eq(ahCodeBatches.eventId, eventId))
    .groupBy(ahCodeBatches.id)
    .orderBy(desc(ahCodeBatches.createdAt));

  return rows;
}

export async function getBatchForPrint(batchId: string): Promise<{
  batch: AhCodeBatch;
  codes: { serial: number; code: string; status: CodeStatus }[];
} | null> {
  const db = getDb();
  const [batch] = await db.select().from(ahCodeBatches).where(eq(ahCodeBatches.id, batchId)).limit(1);
  if (!batch) return null;

  const codes = await db
    .select({
      serial: ahCodes.serial,
      code: ahCodes.code,
      status: ahCodes.status,
    })
    .from(ahCodes)
    .where(eq(ahCodes.batchId, batchId))
    .orderBy(ahCodes.serial);

  return {
    batch,
    codes: codes.map((c) => ({
      serial: c.serial,
      code: c.code,
      status: c.status as CodeStatus,
    })),
  };
}

export async function setCodeAvailability(p: {
  codeId: string;
  action: "DISABLE" | "ENABLE";
  reason: string;
  adminId: string;
}): Promise<{ ok: true } | { ok: false; code: ErrorCode; message: string }> {
  const db = getDb();
  const now = Date.now();
  const [code] = await db.select().from(ahCodes).where(eq(ahCodes.id, p.codeId)).limit(1);
  if (!code) {
    return { ok: false, code: "NOT_FOUND", message: COPY.errors.NOT_FOUND };
  }
  if (code.status === "USED") {
    return { ok: false, code: "CONFLICT", message: "Used codes can't be changed." };
  }
  const from = p.action === "DISABLE" ? "ACTIVE" : "DISABLED";
  if (code.status !== from) {
    return { ok: false, code: "CONFLICT", message: "Used codes can't be changed." };
  }

  const reason = p.reason ? p.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) {
    return { ok: false, code: "VALIDATION", message: COPY.errors.VALIDATION };
  }

  const updateSet =
    p.action === "DISABLE"
      ? {
          status: "DISABLED" as const,
          disabledAt: now,
          disabledBy: p.adminId,
          disabledReason: reason,
        }
      : {
          status: "ACTIVE" as const,
          disabledAt: null,
          disabledBy: null,
          disabledReason: null,
        };

  const auditAction = p.action === "DISABLE" ? "code.disabled" : "code.enabled";

  await db.batch([
    db.update(ahCodes).set(updateSet).where(and(eq(ahCodes.id, p.codeId), eq(ahCodes.status, from))),
    auditInsert(db, {
      eventId: code.eventId,
      teamId: null,
      actorType: "ADMIN",
      actorId: p.adminId,
      action: auditAction,
      targetType: "code",
      targetId: p.codeId,
      metadata: { serial: code.serial, reason },
    }),
  ]);

  return { ok: true };
}

export async function updatePlacementNote(p: {
  codeId: string;
  note: string;
  adminId: string;
}): Promise<{ ok: true }> {
  const db = getDb();
  const note = p.note.slice(0, 200).trim();
  const [code] = await db
    .select({ id: ahCodes.id, eventId: ahCodes.eventId, serial: ahCodes.serial })
    .from(ahCodes)
    .where(eq(ahCodes.id, p.codeId))
    .limit(1);

  if (!code) {
    return { ok: true };
  }

  await db.batch([
    db.update(ahCodes).set({ placementNote: note }).where(eq(ahCodes.id, p.codeId)),
    auditInsert(db, {
      eventId: code.eventId,
      teamId: null,
      actorType: "ADMIN",
      actorId: p.adminId,
      action: "code.note_updated",
      targetType: "code",
      targetId: p.codeId,
      metadata: { serial: code.serial },
    }),
  ]);

  return { ok: true };
}

export async function disableBatch(p: {
  batchId: string;
  reason: string;
  adminId: string;
}): Promise<{ disabled: number }> {
  const db = getDb();
  const now = Date.now();
  const [batch] = await db.select().from(ahCodeBatches).where(eq(ahCodeBatches.id, p.batchId)).limit(1);
  if (!batch) {
    return { disabled: 0 };
  }
  const reason = p.reason.trim();
  const activeCodes = await db
    .select({ id: ahCodes.id })
    .from(ahCodes)
    .where(and(eq(ahCodes.batchId, p.batchId), eq(ahCodes.status, "ACTIVE")));

  if (activeCodes.length === 0) {
    return { disabled: 0 };
  }

  await db.batch([
    db
      .update(ahCodes)
      .set({
        status: "DISABLED",
        disabledAt: now,
        disabledBy: p.adminId,
        disabledReason: reason,
      })
      .where(and(eq(ahCodes.batchId, p.batchId), eq(ahCodes.status, "ACTIVE"))),
    auditInsert(db, {
      eventId: batch.eventId,
      teamId: null,
      actorType: "ADMIN",
      actorId: p.adminId,
      action: "code.batch_disabled",
      targetType: "batch",
      targetId: p.batchId,
      metadata: { batchName: batch.name, count: activeCodes.length, reason },
    }),
  ]);

  return { disabled: activeCodes.length };
}

export async function listCodeAttempts(p: {
  eventId: string;
  teamCode?: string;
  result?: CodeAttemptResult;
  suspicious?: boolean;
  limit?: number;
}): Promise<{
  attempts: {
    id: string;
    createdAt: number;
    teamCode: string;
    teamName: string;
    stageNumber: number | null;
    submittedCode: string | null;
    result: CodeAttemptResult;
    ip: string | null;
  }[];
}> {
  const db = getDb();
  const limit = Math.min(Math.max(p.limit ?? 200, 1), 200);
  const now = Date.now();

  let targetTeamIds: string[] | null = null;
  if (p.suspicious) {
    const suspiciousRows = await db
      .select({ teamId: ahCodeAttempts.teamId })
      .from(ahCodeAttempts)
      .where(
        and(
          eq(ahCodeAttempts.eventId, p.eventId),
          eq(ahCodeAttempts.result, "INVALID"),
          gt(ahCodeAttempts.createdAt, now - 600000),
        ),
      )
      .groupBy(ahCodeAttempts.teamId)
      .having(sql`count(*) >= 5`);

    targetTeamIds = suspiciousRows.map((r) => r.teamId);
    if (targetTeamIds.length === 0) {
      return { attempts: [] };
    }
  }

  const conditions = [eq(ahCodeAttempts.eventId, p.eventId)];
  if (targetTeamIds) {
    conditions.push(inArray(ahCodeAttempts.teamId, targetTeamIds));
  }
  if (p.teamCode) {
    conditions.push(eq(ahTeams.teamCode, p.teamCode));
  }
  if (p.result) {
    conditions.push(eq(ahCodeAttempts.result, p.result));
  }

  const rows = await db
    .select({
      id: ahCodeAttempts.id,
      createdAt: ahCodeAttempts.createdAt,
      teamCode: ahTeams.teamCode,
      teamName: ahTeams.teamName,
      stageNumber: ahStages.stageNumber,
      submittedCode: ahCodeAttempts.submittedCode,
      result: ahCodeAttempts.result,
      ip: ahCodeAttempts.ip,
    })
    .from(ahCodeAttempts)
    .innerJoin(ahTeams, eq(ahCodeAttempts.teamId, ahTeams.id))
    .leftJoin(ahStages, eq(ahCodeAttempts.stageId, ahStages.id))
    .where(and(...conditions))
    .orderBy(desc(ahCodeAttempts.createdAt))
    .limit(limit);

  return {
    attempts: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      teamCode: r.teamCode,
      teamName: r.teamName,
      stageNumber: r.stageNumber ?? null,
      submittedCode: r.submittedCode,
      result: r.result as CodeAttemptResult,
      ip: r.ip,
    })),
  };
}
