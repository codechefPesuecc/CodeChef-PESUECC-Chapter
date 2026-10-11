import { and, desc, eq, like, lt } from "drizzle-orm";
import type { AhVerdict, SubmissionStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import {
  ahAuditLogs,
  ahStages,
  ahSubmissions,
  ahTeams,
  users,
  type AhAuditLog,
  type AhSubmission,
} from "@/server/db/schema";

export async function listSubmissions(p: {
  eventId: string;
  teamCode?: string;
  stageNumber?: number;
  verdict?: AhVerdict;
  cursor?: number;
  limit?: number;
}): Promise<{
  rows: {
    id: string;
    createdAt: number;
    teamCode: string;
    teamName: string;
    stageNumber: number;
    language: string;
    status: SubmissionStatus;
    verdict: AhVerdict | null;
    passed: number | null;
    total: number | null;
  }[];
  nextCursor: number | null;
}> {
  const db = getDb();
  const limit = Math.min(Math.max(p.limit ?? 50, 1), 100);

  const conditions = [eq(ahSubmissions.eventId, p.eventId)];
  if (p.teamCode) {
    conditions.push(eq(ahTeams.teamCode, p.teamCode.trim().toUpperCase()));
  }
  if (p.stageNumber !== undefined) {
    conditions.push(eq(ahStages.stageNumber, p.stageNumber));
  }
  if (p.verdict) {
    conditions.push(eq(ahSubmissions.verdict, p.verdict));
  }
  if (p.cursor !== undefined) {
    conditions.push(lt(ahSubmissions.createdAt, p.cursor));
  }

  const rows = await db
    .select({
      id: ahSubmissions.id,
      createdAt: ahSubmissions.createdAt,
      teamCode: ahTeams.teamCode,
      teamName: ahTeams.teamName,
      stageNumber: ahStages.stageNumber,
      language: ahSubmissions.language,
      status: ahSubmissions.status,
      verdict: ahSubmissions.verdict,
      passed: ahSubmissions.passed,
      total: ahSubmissions.total,
    })
    .from(ahSubmissions)
    .innerJoin(ahTeams, eq(ahSubmissions.teamId, ahTeams.id))
    .innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
    .where(and(...conditions))
    .orderBy(desc(ahSubmissions.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].createdAt : null;

  return {
    rows: sliced.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      teamCode: r.teamCode,
      teamName: r.teamName,
      stageNumber: r.stageNumber,
      language: r.language,
      status: r.status as SubmissionStatus,
      verdict: (r.verdict as AhVerdict) ?? null,
      passed: r.passed,
      total: r.total,
    })),
    nextCursor,
  };
}

export async function getSubmissionDetail(
  id: string
): Promise<
  | (AhSubmission & {
      teamCode: string;
      teamName: string;
      stageNumber: number;
    })
  | null
> {
  const db = getDb();
  const [row] = await db
    .select({
      submission: ahSubmissions,
      teamCode: ahTeams.teamCode,
      teamName: ahTeams.teamName,
      stageNumber: ahStages.stageNumber,
    })
    .from(ahSubmissions)
    .innerJoin(ahTeams, eq(ahSubmissions.teamId, ahTeams.id))
    .innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
    .where(eq(ahSubmissions.id, id))
    .limit(1);

  if (!row) return null;

  return {
    ...row.submission,
    teamCode: row.teamCode,
    teamName: row.teamName,
    stageNumber: row.stageNumber,
  };
}

function formatAuditActivity(action: string, teamName: string | null, metadataStr: string): string {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(metadataStr);
  } catch {
    // ignore
  }

  switch (action) {
    case "team.checked_in":
      return meta.bulk
        ? `Bulk checked in team ${teamName ?? ""}`
        : `Checked in team ${teamName ?? ""}`;
    case "code.redeemed":
      return `Redeemed code for question ${meta.stageNumber ?? ""}`;
    case "code.attempt_suspicious":
      return `Suspicious activity: ${meta.invalidIn10m ?? 5} invalid attempts in 10 minutes`;
    case "code.batch_created":
      return `Created code batch "${meta.name ?? ""}" (${meta.size ?? ""} codes: #${meta.serialFrom}–#${meta.serialTo})`;
    case "code.batch_disabled":
      return `Disabled batch "${meta.batchName ?? ""}": ${meta.count ?? ""} active codes`;
    case "code.disabled":
      return `Disabled code #${meta.serial}: ${meta.reason ?? ""}`;
    case "code.enabled":
      return `Re-enabled code #${meta.serial}: ${meta.reason ?? ""}`;
    case "code.note_updated":
      return `Updated note for code #${meta.serial}`;
    case "volunteer.assigned":
      return `Assigned volunteer @${meta.username ?? ""}`;
    case "volunteer.removed":
      return `Removed volunteer`;
    default:
      return `${action}`;
  }
}

export async function listAudit(p: {
  eventId: string;
  teamCode?: string;
  actionPrefix?: string;
  before?: number;
  limit?: number;
}): Promise<{
  rows: (AhAuditLog & {
    teamName: string | null;
    actorName: string | null;
    text: string;
  })[];
  nextCursor: number | null;
}> {
  const db = getDb();
  const limit = Math.min(Math.max(p.limit ?? 50, 1), 200);

  const conditions = [eq(ahAuditLogs.eventId, p.eventId)];
  if (p.teamCode) {
    conditions.push(eq(ahTeams.teamCode, p.teamCode.trim().toUpperCase()));
  }
  if (p.actionPrefix) {
    conditions.push(like(ahAuditLogs.action, `${p.actionPrefix}%`));
  }
  if (p.before !== undefined) {
    conditions.push(lt(ahAuditLogs.createdAt, p.before));
  }

  const rows = await db
    .select({
      log: ahAuditLogs,
      teamName: ahTeams.teamName,
      userName: users.name,
      userUsername: users.username,
    })
    .from(ahAuditLogs)
    .leftJoin(ahTeams, eq(ahAuditLogs.teamId, ahTeams.id))
    .leftJoin(users, eq(ahAuditLogs.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(ahAuditLogs.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].log.createdAt : null;

  return {
    rows: sliced.map((r) => ({
      ...r.log,
      teamName: r.teamName ?? null,
      actorName: r.userName ?? r.userUsername ?? r.log.actorId ?? null,
      text: formatAuditActivity(r.log.action, r.teamName, r.log.metadata),
    })),
    nextCursor,
  };
}
