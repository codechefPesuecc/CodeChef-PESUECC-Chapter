import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { CodeAttemptResult, SubmissionView, TeamStatus } from "@/lib/algohunt/types";
import { hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db";
import {
  ahAuditLogs, ahCodeAttempts, ahCodes, ahDisqualifications, ahEvents, ahStageProgress, ahStages,
  ahSubmissions, ahTeamMembers, ahTeams, users,
  type AhDisqualification, type AhEvent, type AhTeam, type AhTeamMember,
} from "@/server/db/schema";
import { getTeamProgress, type TeamProgress } from "../access";
import { auditInsert } from "../audit";
import { generateTeamPassword } from "../teamSession";
import { activityKind, describeActivity, describeSubmission, parseAuditMetadata } from "./activity";
import { feedAuditFilter } from "./feedFilter";

export interface AdminTeamRow {
  id: string;
  code: string;
  name: string;
  college: string | null;
  status: TeamStatus;
  currentQuestion: number | null;
  questionsSolved: number;
  waitingForCode: boolean;
  /** When the oldest solved-but-not-completed question was solved; the list shows minutes waiting. */
  waitingSince: number | null;
  totalStages: number;
  lastActivityAt: number | null;
  checkedInAt: number | null;
  finishedAt: number | null;
}

/** Team list for one event. 4 queries: teams, progress aggregates, last submission, last code attempt. */
export async function listTeams(eventId: string, f: { q?: string; status?: TeamStatus }): Promise<AdminTeamRow[]> {
  const db = getDb();
  const filters: SQL[] = [eq(ahTeams.eventId, eventId)];
  if (f.status) filters.push(eq(ahTeams.status, f.status));
  const q = f.q?.trim().toLowerCase();
  // instr() instead of LIKE so % and _ in the search box are plain text.
  if (q) {
    filters.push(or(
      sql`instr(lower(${ahTeams.teamCode}), ${q}) > 0`,
      sql`instr(lower(${ahTeams.teamName}), ${q}) > 0`,
      sql`instr(lower(coalesce(${ahTeams.college}, '')), ${q}) > 0`,
    )!);
  }

  const [teamRows, progressRows, submissionRows, attemptRows] = await Promise.all([
    db.select({
      id: ahTeams.id, code: ahTeams.teamCode, name: ahTeams.teamName, college: ahTeams.college,
      status: ahTeams.status, checkedInAt: ahTeams.checkedInAt, finishedAt: ahTeams.finishedAt,
      totalStages: sql<number>`(SELECT count(*) FROM ah_stages WHERE event_id = ${eventId})`,
      eventStartedAt: sql<number | null>`(SELECT started_at FROM ah_events WHERE id = ${eventId})`,
    }).from(ahTeams).where(and(...filters)).orderBy(asc(ahTeams.teamCode)),
    db.select({
      teamId: ahStageProgress.teamId,
      solved: sql<number>`sum(CASE WHEN ${ahStageProgress.challengeSolved} = 1 THEN 1 ELSE 0 END)`,
      completed: sql<number>`sum(CASE WHEN ${ahStageProgress.completed} = 1 THEN 1 ELSE 0 END)`,
      waitingSince: sql<number | null>`min(CASE WHEN ${ahStageProgress.challengeSolved} = 1
        AND ${ahStageProgress.completed} = 0 THEN ${ahStageProgress.challengeSolvedAt} END)`,
    }).from(ahStageProgress).where(eq(ahStageProgress.eventId, eventId)).groupBy(ahStageProgress.teamId),
    db.select({ teamId: ahSubmissions.teamId, last: sql<number>`max(${ahSubmissions.createdAt})` })
      .from(ahSubmissions).where(eq(ahSubmissions.eventId, eventId)).groupBy(ahSubmissions.teamId),
    db.select({ teamId: ahCodeAttempts.teamId, last: sql<number>`max(${ahCodeAttempts.createdAt})` })
      .from(ahCodeAttempts).where(eq(ahCodeAttempts.eventId, eventId)).groupBy(ahCodeAttempts.teamId),
  ]);

  const progressByTeam = new Map(progressRows.map((row) => [row.teamId, row]));
  const lastSubmission = new Map(submissionRows.map((row) => [row.teamId, Number(row.last)]));
  const lastAttempt = new Map(attemptRows.map((row) => [row.teamId, Number(row.last)]));

  return teamRows.map((team) => {
    const progress = progressByTeam.get(team.id);
    const completed = Number(progress?.completed ?? 0);
    const totalStages = Number(team.totalStages);
    const waitingSince = progress?.waitingSince === null || progress?.waitingSince === undefined
      ? null
      : Number(progress.waitingSince);
    const notStarted = team.eventStartedAt === null || team.status === "REGISTERED";
    const done = team.status === "FINISHED" || team.status === "DISQUALIFIED" || completed >= totalStages;
    const activity = [lastSubmission.get(team.id), lastAttempt.get(team.id)].filter((at): at is number => at !== undefined);
    return {
      id: team.id,
      code: team.code,
      name: team.name,
      college: team.college,
      status: team.status as TeamStatus,
      currentQuestion: notStarted || done ? null : completed + 1,
      questionsSolved: Number(progress?.solved ?? 0),
      waitingForCode: waitingSince !== null,
      waitingSince,
      totalStages,
      lastActivityAt: activity.length > 0 ? Math.max(...activity) : null,
      checkedInAt: team.checkedInAt,
      finishedAt: team.finishedAt,
    };
  });
}

export interface TeamBrief {
  id: string;
  eventId: string;
  teamCode: string;
  teamName: string;
}

/** The few fields a route needs to find the team's event and check the typed confirmation. */
export async function getTeamBrief(teamId: string): Promise<TeamBrief | null> {
  const [row] = await getDb().select({
    id: ahTeams.id, eventId: ahTeams.eventId, teamCode: ahTeams.teamCode, teamName: ahTeams.teamName,
  }).from(ahTeams).where(eq(ahTeams.id, teamId)).limit(1);
  return row ?? null;
}

export interface AdminTeamDetail {
  /** The password hash never leaves the server. */
  team: Omit<AhTeam, "passwordHash">;
  event: AhEvent;
  members: AhTeamMember[];
  progress: TeamProgress;
  codesUsed: { serial: number; stageNumber: number; usedAt: number }[];
  submissions: Omit<SubmissionView, "detail">[];
  codeAttempts: { createdAt: number; stageNumber: number | null; result: CodeAttemptResult; submittedCode: string | null }[];
  disqualifications: AhDisqualification[];
}

const DETAIL_SUBMISSIONS_LIMIT = 500;
const DETAIL_ATTEMPTS_LIMIT = 50;

/** Everything an admin needs for one team. Codes appear by serial only; submissions never carry source. */
export async function getTeamDetail(teamId: string): Promise<AdminTeamDetail | null> {
  const db = getDb();
  const [row] = await db.select({ team: ahTeams, event: ahEvents }).from(ahTeams)
    .innerJoin(ahEvents, eq(ahTeams.eventId, ahEvents.id))
    .where(eq(ahTeams.id, teamId)).limit(1);
  if (!row) return null;

  const [members, progress, codesUsed, submissions, codeAttempts, disqualifications] = await Promise.all([
    db.select().from(ahTeamMembers).where(eq(ahTeamMembers.teamId, teamId))
      .orderBy(desc(ahTeamMembers.isCaptain), asc(ahTeamMembers.createdAt)),
    getTeamProgress(row),
    db.select({ serial: ahCodes.serial, stageNumber: ahStages.stageNumber, usedAt: ahCodes.usedAt })
      .from(ahCodes).innerJoin(ahStages, eq(ahCodes.usedAfterStageId, ahStages.id))
      .where(and(eq(ahCodes.eventId, row.event.id), eq(ahCodes.usedByTeamId, teamId)))
      .orderBy(asc(ahCodes.usedAt)),
    db.select({
      id: ahSubmissions.id, stageNumber: ahStages.stageNumber, language: ahSubmissions.language,
      status: ahSubmissions.status, verdict: ahSubmissions.verdict, passed: ahSubmissions.passed,
      total: ahSubmissions.total, failedOn: ahSubmissions.failedOn, runtimeMs: ahSubmissions.runtimeMs,
      createdAt: ahSubmissions.createdAt, finishedAt: ahSubmissions.finishedAt,
    }).from(ahSubmissions).innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
      .where(eq(ahSubmissions.teamId, teamId))
      .orderBy(desc(ahSubmissions.createdAt))
      .limit(DETAIL_SUBMISSIONS_LIMIT),
    db.select({
      createdAt: ahCodeAttempts.createdAt, stageNumber: ahStages.stageNumber,
      result: ahCodeAttempts.result, submittedCode: ahCodeAttempts.submittedCode,
    }).from(ahCodeAttempts).leftJoin(ahStages, eq(ahCodeAttempts.stageId, ahStages.id))
      .where(eq(ahCodeAttempts.teamId, teamId))
      .orderBy(desc(ahCodeAttempts.createdAt))
      .limit(DETAIL_ATTEMPTS_LIMIT),
    db.select().from(ahDisqualifications).where(eq(ahDisqualifications.teamId, teamId))
      .orderBy(desc(ahDisqualifications.createdAt)),
  ]);

  return {
    team: publicTeamFields(row.team),
    event: row.event,
    members,
    progress,
    codesUsed: codesUsed.map((code) => ({ serial: code.serial, stageNumber: code.stageNumber, usedAt: code.usedAt ?? 0 })),
    submissions: submissions.map((s) => ({
      ...s, status: s.status as SubmissionView["status"], verdict: s.verdict as SubmissionView["verdict"],
    })),
    codeAttempts: codeAttempts.map((a) => ({ ...a, result: a.result as CodeAttemptResult })),
    disqualifications,
  };
}

/** Allowlist, so a secret column added to ah_teams later stays out of admin responses by default. */
function publicTeamFields(team: AhTeam): Omit<AhTeam, "passwordHash"> {
  return {
    id: team.id, eventId: team.eventId, teamCode: team.teamCode, teamName: team.teamName, college: team.college,
    sessionEpoch: team.sessionEpoch, status: team.status, checkedInAt: team.checkedInAt, finishedAt: team.finishedAt,
    disqualifiedAt: team.disqualifiedAt, disqualificationReason: team.disqualificationReason,
    createdAt: team.createdAt, updatedAt: team.updatedAt,
  };
}

export interface TimelineEntry {
  at: number;
  kind: string;
  text: string;
  meta?: Record<string, unknown>;
}

const TIMELINE_LIMIT = 500;

/**
 * Audit rows, submissions and code attempts for one team, oldest first, at most 500 (the newest
 * 500 when there are more). Never includes source code or typed code values.
 */
export async function getTeamTimeline(teamId: string): Promise<TimelineEntry[]> {
  const db = getDb();
  const [team] = await db.select({ teamName: ahTeams.teamName }).from(ahTeams).where(eq(ahTeams.id, teamId)).limit(1);
  if (!team) return [];

  const [auditRows, submissionRows, attemptRows] = await Promise.all([
    db.select({
      id: ahAuditLogs.id, action: ahAuditLogs.action, targetType: ahAuditLogs.targetType,
      metadata: ahAuditLogs.metadata, actorType: ahAuditLogs.actorType, createdAt: ahAuditLogs.createdAt,
      actorName: users.name, actorUsername: users.username,
    }).from(ahAuditLogs).leftJoin(users, eq(ahAuditLogs.actorId, users.id))
      // Submission rows carry the verdict, and code / override completions have their own row.
      .where(and(eq(ahAuditLogs.teamId, teamId), feedAuditFilter))
      .orderBy(desc(ahAuditLogs.createdAt))
      .limit(TIMELINE_LIMIT),
    db.select({
      id: ahSubmissions.id, status: ahSubmissions.status, verdict: ahSubmissions.verdict,
      failedOn: ahSubmissions.failedOn, createdAt: ahSubmissions.createdAt, stageNumber: ahStages.stageNumber,
    }).from(ahSubmissions).innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
      .where(eq(ahSubmissions.teamId, teamId))
      .orderBy(desc(ahSubmissions.createdAt))
      .limit(TIMELINE_LIMIT),
    db.select({
      result: ahCodeAttempts.result, createdAt: ahCodeAttempts.createdAt, stageNumber: ahStages.stageNumber,
    }).from(ahCodeAttempts).leftJoin(ahStages, eq(ahCodeAttempts.stageId, ahStages.id))
      .where(eq(ahCodeAttempts.teamId, teamId))
      .orderBy(desc(ahCodeAttempts.createdAt))
      .limit(TIMELINE_LIMIT),
  ]);

  const entries: TimelineEntry[] = [
    ...auditRows.map((row) => ({
      at: row.createdAt,
      kind: activityKind(row.action),
      text: describeActivity({
        action: row.action, metadata: parseAuditMetadata(row.metadata), targetType: row.targetType,
        teamName: team.teamName, actorName: row.actorName ?? row.actorUsername,
      }),
      meta: { action: row.action, actorType: row.actorType },
    })),
    ...submissionRows.map((row) => ({
      at: row.createdAt,
      kind: "submission",
      text: describeSubmission({ ...row, teamName: team.teamName }),
      meta: { submissionId: row.id, status: row.status, verdict: row.verdict, stageNumber: row.stageNumber },
    })),
    ...attemptRows.map((row) => ({
      at: row.createdAt,
      kind: "code",
      text: `${team.teamName} entered a code${row.stageNumber === null ? "" : ` on Question ${row.stageNumber}`}: ${row.result}`,
      meta: { result: row.result, stageNumber: row.stageNumber },
    })),
  ];
  return entries.sort((a, b) => a.at - b.at).slice(-TIMELINE_LIMIT);
}

/**
 * New team password, shown once. Bumping session_epoch logs every device out. The audit row
 * never carries the password.
 */
export async function resetTeamPassword(p: { teamId: string; adminId: string; ip?: string }): Promise<{ password: string }> {
  const db = getDb();
  const [team] = await db.select({ eventId: ahTeams.eventId }).from(ahTeams).where(eq(ahTeams.id, p.teamId)).limit(1);
  if (!team) throw new Error("Team not found");
  const password = generateTeamPassword();
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const [updated] = await db.batch([
    db.update(ahTeams).set({
      passwordHash, sessionEpoch: sql`${ahTeams.sessionEpoch} + 1`, updatedAt: now,
    }).where(eq(ahTeams.id, p.teamId)).returning({ id: ahTeams.id }),
    auditInsert(db, {
      eventId: team.eventId, teamId: p.teamId, actorType: "ADMIN", actorId: p.adminId,
      action: "team.password_reset", targetType: "team", targetId: p.teamId, metadata: {}, ip: p.ip,
    }),
  ]);
  if (updated.length !== 1) throw new Error("Team not found");
  return { password };
}
