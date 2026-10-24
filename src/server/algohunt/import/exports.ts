import * as XLSX from "xlsx";
import { asc, desc, eq } from "drizzle-orm";
import { formatDuration, formatIST } from "@/lib/algohunt/format";
import { getDb } from "@/server/db";
import {
  ahAuditLogs, ahChallenges, ahCodeAttempts, ahCodeBatches, ahCodes, ahStages, ahSubmissions, ahTeamMembers, ahTeams,
  users, type AhEvent,
} from "@/server/db/schema";
import { computeLeaderboard } from "../leaderboard";

export const EXPORT_TYPES = ["results", "submissions", "codes", "code_attempts", "audit", "teams"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const MAX_EXPORT_ROWS = 20_000;

type Cell = string | number | null;

function when(ms: number | null): string {
  return ms === null ? "" : formatIST(ms, { withDate: true });
}

async function membersByTeam(eventId: string) {
  const rows = await getDb().select({
    teamId: ahTeamMembers.teamId, name: ahTeamMembers.name, email: ahTeamMembers.email,
    phone: ahTeamMembers.phone, isCaptain: ahTeamMembers.isCaptain,
  }).from(ahTeamMembers)
    .innerJoin(ahTeams, eq(ahTeamMembers.teamId, ahTeams.id))
    .where(eq(ahTeams.eventId, eventId))
    .orderBy(asc(ahTeamMembers.createdAt));
  const map = new Map<string, typeof rows>();
  for (const row of rows) map.set(row.teamId, [...(map.get(row.teamId) ?? []), row]);
  return map;
}

async function stageNumbers(eventId: string): Promise<Map<string, number>> {
  const rows = await getDb().select({ id: ahStages.id, n: ahStages.stageNumber }).from(ahStages)
    .where(eq(ahStages.eventId, eventId));
  return new Map(rows.map((row) => [row.id, row.n]));
}

async function sheetRows(event: AhEvent, type: ExportType): Promise<{ header: string[]; rows: Cell[][] }> {
  const db = getDb();
  switch (type) {
    case "results": {
      const [board, members] = await Promise.all([
        computeLeaderboard(event.id, { includeDisqualified: true }), membersByTeam(event.id),
      ]);
      return {
        header: ["Rank", "Team", "Code", "College", "Members", "Questions solved", "Points", "Finished at (IST)",
          "Elapsed", "Status", "Integrity flags"],
        rows: board.rows.map((row) => [
          row.disqualified ? "DQ" : row.rank, row.teamName, row.teamCode, row.college ?? "",
          (members.get(row.teamId) ?? []).map((m) => m.name).join(", "),
          row.questionsSolved, row.points, when(row.finishedAt),
          row.finishedAt !== null && event.startedAt !== null ? formatDuration(row.finishedAt - event.startedAt) : "",
          row.disqualified ? "DISQUALIFIED" : row.finished ? "FINISHED" : "PLAYING", row.flags,
        ]),
      };
    }
    case "submissions": {
      // Never the source code: only who, when, which question and the verdict.
      const rows = await db.select({
        at: ahSubmissions.createdAt, team: ahTeams.teamName, code: ahTeams.teamCode, stage: ahStages.stageNumber,
        question: ahChallenges.title, language: ahSubmissions.language, status: ahSubmissions.status,
        verdict: ahSubmissions.verdict, passed: ahSubmissions.passed, total: ahSubmissions.total,
      }).from(ahSubmissions)
        .innerJoin(ahTeams, eq(ahSubmissions.teamId, ahTeams.id))
        .innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
        .innerJoin(ahChallenges, eq(ahSubmissions.challengeId, ahChallenges.id))
        .where(eq(ahSubmissions.eventId, event.id))
        .orderBy(asc(ahSubmissions.createdAt))
        .limit(MAX_EXPORT_ROWS);
      return {
        header: ["Time (IST)", "Team", "Code", "Question", "Title", "Language", "Verdict", "Passed/Total"],
        rows: rows.map((row) => [
          when(row.at), row.team, row.code, row.stage, row.question, row.language,
          row.verdict ?? row.status, row.total === null ? "" : `${row.passed ?? 0}/${row.total}`,
        ]),
      };
    }
    case "codes": {
      const [rows, stages] = await Promise.all([
        db.select({
          serial: ahCodes.serial, code: ahCodes.code, batch: ahCodeBatches.name, status: ahCodes.status,
          team: ahTeams.teamName, afterStageId: ahCodes.usedAfterStageId, usedAt: ahCodes.usedAt,
          disabledReason: ahCodes.disabledReason, note: ahCodes.placementNote,
        }).from(ahCodes)
          .innerJoin(ahCodeBatches, eq(ahCodes.batchId, ahCodeBatches.id))
          .leftJoin(ahTeams, eq(ahCodes.usedByTeamId, ahTeams.id))
          .where(eq(ahCodes.eventId, event.id))
          .orderBy(asc(ahCodes.serial))
          .limit(MAX_EXPORT_ROWS),
        stageNumbers(event.id),
      ]);
      return {
        header: ["Serial", "Code", "Batch", "Status", "Used by (team)", "Unlocked after question", "Used at (IST)",
          "Disabled reason", "Placement note"],
        rows: rows.map((row) => [
          row.serial, row.code, row.batch, row.status, row.team ?? "",
          row.afterStageId ? (stages.get(row.afterStageId) ?? "") : "", when(row.usedAt),
          row.disabledReason ?? "", row.note ?? "",
        ]),
      };
    }
    case "code_attempts": {
      const [rows, stages] = await Promise.all([
        db.select({
          at: ahCodeAttempts.createdAt, team: ahTeams.teamName, code: ahTeams.teamCode, stageId: ahCodeAttempts.stageId,
          typed: ahCodeAttempts.submittedCode, result: ahCodeAttempts.result, ip: ahCodeAttempts.ip,
        }).from(ahCodeAttempts)
          .innerJoin(ahTeams, eq(ahCodeAttempts.teamId, ahTeams.id))
          .where(eq(ahCodeAttempts.eventId, event.id))
          .orderBy(asc(ahCodeAttempts.createdAt))
          .limit(MAX_EXPORT_ROWS),
        stageNumbers(event.id),
      ]);
      return {
        header: ["Time (IST)", "Team", "Team code", "Question", "Typed code", "Result", "IP"],
        rows: rows.map((row) => [
          when(row.at), row.team, row.code, row.stageId ? (stages.get(row.stageId) ?? "") : "",
          row.typed ?? "", row.result, row.ip ?? "",
        ]),
      };
    }
    case "audit": {
      const rows = await db.select({
        at: ahAuditLogs.createdAt, actorType: ahAuditLogs.actorType, actorId: ahAuditLogs.actorId,
        actorName: users.name, actorUsername: users.username, action: ahAuditLogs.action,
        targetType: ahAuditLogs.targetType, targetId: ahAuditLogs.targetId, team: ahTeams.teamName,
        metadata: ahAuditLogs.metadata,
      }).from(ahAuditLogs)
        .leftJoin(users, eq(ahAuditLogs.actorId, users.id))
        .leftJoin(ahTeams, eq(ahAuditLogs.teamId, ahTeams.id))
        .where(eq(ahAuditLogs.eventId, event.id))
        .orderBy(desc(ahAuditLogs.createdAt))
        .limit(MAX_EXPORT_ROWS);
      return {
        header: ["Time (IST)", "Actor type", "Actor", "Action", "Target", "Team", "Metadata (JSON)"],
        rows: rows.map((row) => [
          when(row.at), row.actorType, row.actorName ?? row.actorUsername ?? row.actorId ?? "", row.action,
          row.targetType ? `${row.targetType}${row.targetId ? `:${row.targetId}` : ""}` : "", row.team ?? "", row.metadata,
        ]),
      };
    }
    case "teams": {
      const [teams, members] = await Promise.all([
        db.select().from(ahTeams).where(eq(ahTeams.eventId, event.id)).orderBy(asc(ahTeams.teamCode)).limit(MAX_EXPORT_ROWS),
        membersByTeam(event.id),
      ]);
      return {
        header: ["Code", "Name", "College", "Members", "Emails", "Phones", "Captain", "Status", "Checked in at (IST)"],
        rows: teams.map((team) => {
          const list = members.get(team.id) ?? [];
          return [
            team.teamCode, team.teamName, team.college ?? "", list.map((m) => m.name).join(", "),
            list.map((m) => m.email ?? "").filter(Boolean).join(", "), list.map((m) => m.phone ?? "").filter(Boolean).join(", "),
            list.find((m) => m.isCaptain)?.name ?? "", team.status, when(team.checkedInAt),
          ];
        }),
      };
    }
  }
}

/** One .xlsx workbook with a single sheet (M6 brief §5.6). Passwords and source code are never exported. */
export async function buildExport(event: AhEvent, type: ExportType): Promise<{ filename: string; buffer: Uint8Array }> {
  const { header, rows } = await sheetRows(event, type);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = header.map((h) => ({ wch: Math.min(40, Math.max(10, h.length + 2)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, type.replace("_", " "));
  const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { filename: `algohunt-${type}-${event.slug}.xlsx`, buffer: new Uint8Array(data) };
}
