import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { FREQUENT_AWAY_COUNT } from "@/lib/algohunt/integrity-rules";
import type { CodePoolStats, EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import {
  ahAuditLogs, ahChallenges, ahCodeAttempts, ahStageProgress, ahStages, ahSubmissions, ahTeams, users,
  type AhEvent,
} from "@/server/db/schema";
import { getCodePoolStats } from "../codePool";
import { computeLeaderboard } from "../leaderboard";
import { activityKind, describeActivity, describeSubmission, parseAuditMetadata, type ActivityKind } from "./activity";
import { feedAuditFilter } from "./feedFilter";
import { getHealth, type AdminHealth } from "./health";

export interface AdminOverview {
  event: {
    id: string; slug: string; name: string; status: EventStatus; isTest: boolean; startedAt: number | null;
    pausedAt: number | null; endedAt: number | null; submissionsEnabled: boolean; codesEnabled: boolean;
    leaderboardVisible: boolean;
  };
  counts: {
    teamsTotal: number; registered: number; checkedIn: number; finished: number; disqualified: number;
    submissions: number; accepted: number; rejected: number; judgeErrors10m: number; suspiciousCodeTeams10m: number;
  };
  codePool: CodePoolStats & { lowPool: boolean };
  /** CODE_PENDING teams, longest wait first, top 10. teamId is extra so the quick action can call the override route. */
  stuck: { teamId: string; teamCode: string; teamName: string; stageNumber: number; waitingSinceMs: number }[];
  /** Teams with FREQUENT_AWAY_COUNT+ integrity flags, most first, top 10: someone should go and look. */
  integrityAlerts: { teamId: string; teamCode: string; teamName: string; flags: number }[];
  readiness: { stages: number; challengesUnverified: number; finalStageOk: boolean; activeCodes: number; checkedInTeams: number };
  topTeams: { rank: number; teamName: string; teamCode: string; questionsSolved: number; finishedAt: number | null }[];
  recentActivity: { at: number; text: string; kind: ActivityKind; teamId?: string }[];
  health: AdminHealth;
  serverNow: number;
}

const TEN_MINUTES = 10 * 60_000;
const SUSPICIOUS_INVALID_ATTEMPTS = 5;
const LOW_POOL_ACTIVE = 5;

/** Command center snapshot for one event. 14 DB queries: GROUP BY counts, never one query per number. */
export async function getOverview(event: AhEvent): Promise<AdminOverview> {
  const db = getDb();
  const now = Date.now();
  const since = now - TEN_MINUTES;
  const judgedAt = sql<number>`coalesce(${ahSubmissions.finishedAt}, ${ahSubmissions.createdAt})`;

  const [
    teamRows, submissionRows, [judgeErrorRow], suspiciousRows, pool, stuckRows, stageRows,
    leaderboard, auditRows, judgedRows, health,
  ] = await Promise.all([
    db.select({
      status: ahTeams.status,
      count: sql<number>`count(*)`,
      checkedIn: sql<number>`count(${ahTeams.checkedInAt})`,
    }).from(ahTeams).where(eq(ahTeams.eventId, event.id)).groupBy(ahTeams.status),
    db.select({ status: ahSubmissions.status, verdict: ahSubmissions.verdict, count: sql<number>`count(*)` })
      .from(ahSubmissions).where(eq(ahSubmissions.eventId, event.id))
      .groupBy(ahSubmissions.status, ahSubmissions.verdict),
    db.select({ count: sql<number>`count(*)` }).from(ahSubmissions)
      .where(and(eq(ahSubmissions.eventId, event.id), eq(ahSubmissions.status, "FAILED"), gt(judgedAt, since))),
    db.select({ teamId: ahCodeAttempts.teamId }).from(ahCodeAttempts)
      .where(and(
        eq(ahCodeAttempts.eventId, event.id), eq(ahCodeAttempts.result, "INVALID"), gt(ahCodeAttempts.createdAt, since),
      ))
      .groupBy(ahCodeAttempts.teamId)
      .having(sql`count(*) >= ${SUSPICIOUS_INVALID_ATTEMPTS}`),
    getCodePoolStats(event.id),
    db.select({
      teamId: ahTeams.id, teamCode: ahTeams.teamCode, teamName: ahTeams.teamName,
      stageNumber: ahStages.stageNumber, solvedAt: ahStageProgress.challengeSolvedAt,
    }).from(ahStageProgress)
      .innerJoin(ahStages, eq(ahStageProgress.stageId, ahStages.id))
      .innerJoin(ahTeams, eq(ahStageProgress.teamId, ahTeams.id))
      .where(and(
        eq(ahStageProgress.eventId, event.id), eq(ahStageProgress.challengeSolved, true),
        eq(ahStageProgress.completed, false), eq(ahStages.isFinal, false), eq(ahTeams.status, "CHECKED_IN"),
      ))
      .orderBy(asc(ahStageProgress.challengeSolvedAt))
      .limit(10),
    db.select({ stageNumber: ahStages.stageNumber, isFinal: ahStages.isFinal, verifiedAt: ahChallenges.verifiedAt })
      .from(ahStages).innerJoin(ahChallenges, eq(ahStages.challengeId, ahChallenges.id))
      .where(eq(ahStages.eventId, event.id)),
    computeLeaderboard(event.id, { includeDisqualified: true }),
    db.select({
      action: ahAuditLogs.action, targetType: ahAuditLogs.targetType, metadata: ahAuditLogs.metadata,
      teamId: ahAuditLogs.teamId, createdAt: ahAuditLogs.createdAt,
      teamName: ahTeams.teamName, actorName: users.name, actorUsername: users.username,
    }).from(ahAuditLogs)
      .leftJoin(ahTeams, eq(ahAuditLogs.teamId, ahTeams.id))
      .leftJoin(users, eq(ahAuditLogs.actorId, users.id))
      // Judged submissions come from ah_submissions below, and code / override completions have their own row.
      .where(and(eq(ahAuditLogs.eventId, event.id), feedAuditFilter))
      .orderBy(desc(ahAuditLogs.createdAt))
      .limit(25),
    db.select({
      at: judgedAt, status: ahSubmissions.status, verdict: ahSubmissions.verdict, failedOn: ahSubmissions.failedOn,
      teamId: ahSubmissions.teamId, teamName: ahTeams.teamName, stageNumber: ahStages.stageNumber,
    }).from(ahSubmissions)
      .innerJoin(ahTeams, eq(ahSubmissions.teamId, ahTeams.id))
      .innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
      .where(and(eq(ahSubmissions.eventId, event.id), inArray(ahSubmissions.status, ["DONE", "FAILED"])))
      .orderBy(desc(judgedAt))
      .limit(25),
    getHealth(),
  ]);

  const teamCount = (status: string) => Number(teamRows.find((row) => row.status === status)?.count ?? 0);
  const checkedIn = teamRows.reduce((sum, row) => sum + Number(row.checkedIn), 0);
  let submissions = 0;
  let accepted = 0;
  let rejected = 0;
  for (const row of submissionRows) {
    const count = Number(row.count);
    submissions += count;
    if (row.status === "DONE" && row.verdict === "AC") accepted += count;
    else if (row.status === "DONE" && row.verdict !== null) rejected += count;
  }

  const finals = stageRows.filter((row) => row.isFinal);
  const highest = Math.max(0, ...stageRows.map((row) => row.stageNumber));

  const recentActivity: AdminOverview["recentActivity"] = [
    ...auditRows.map((row) => ({
      at: row.createdAt,
      text: describeActivity({
        action: row.action, metadata: parseAuditMetadata(row.metadata), targetType: row.targetType,
        teamName: row.teamName, actorName: row.actorName ?? row.actorUsername,
      }),
      kind: activityKind(row.action),
      ...(row.teamId ? { teamId: row.teamId } : {}),
    })),
    ...judgedRows.map((row) => ({
      at: Number(row.at),
      text: describeSubmission(row),
      kind: "submission" as const,
      teamId: row.teamId,
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 40);

  return {
    event: {
      id: event.id, slug: event.slug, name: event.name, status: event.status as EventStatus, isTest: event.isTest,
      startedAt: event.startedAt, pausedAt: event.pausedAt, endedAt: event.endedAt,
      submissionsEnabled: event.submissionsEnabled, codesEnabled: event.codesEnabled,
      leaderboardVisible: event.leaderboardVisible,
    },
    counts: {
      teamsTotal: teamRows.reduce((sum, row) => sum + Number(row.count), 0),
      registered: teamCount("REGISTERED"),
      checkedIn,
      finished: teamCount("FINISHED"),
      disqualified: teamCount("DISQUALIFIED"),
      submissions,
      accepted,
      rejected,
      judgeErrors10m: Number(judgeErrorRow?.count ?? 0),
      suspiciousCodeTeams10m: suspiciousRows.length,
    },
    codePool: {
      ...pool,
      lowPool: pool.active <= LOW_POOL_ACTIVE || pool.active < pool.teamsWaitingForCode,
    },
    stuck: stuckRows.map((row) => ({
      teamId: row.teamId, teamCode: row.teamCode, teamName: row.teamName, stageNumber: row.stageNumber,
      waitingSinceMs: row.solvedAt === null ? 0 : Math.max(0, now - row.solvedAt),
    })),
    // The leaderboard already carries each team's flag count, so this costs no extra query.
    integrityAlerts: leaderboard.rows
      .filter((row) => !row.disqualified && row.flags >= FREQUENT_AWAY_COUNT)
      .sort((a, b) => b.flags - a.flags)
      .slice(0, 10)
      .map((row) => ({ teamId: row.teamId, teamCode: row.teamCode, teamName: row.teamName, flags: row.flags })),
    readiness: {
      stages: stageRows.length,
      challengesUnverified: stageRows.filter((row) => row.verifiedAt === null).length,
      finalStageOk: finals.length === 1 && finals[0].stageNumber === highest,
      activeCodes: pool.active,
      checkedInTeams: checkedIn,
    },
    topTeams: leaderboard.rows.filter((row) => !row.disqualified).slice(0, 5).map((row) => ({
      rank: row.rank, teamName: row.teamName, teamCode: row.teamCode,
      questionsSolved: row.questionsSolved, finishedAt: row.finishedAt,
    })),
    recentActivity,
    health,
    serverNow: now,
  };
}
