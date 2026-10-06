import { and, eq, sql } from "drizzle-orm";
import type { LeaderboardRow, RankingMode } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahStageProgress, ahStages, ahTeams } from "@/server/db/schema";
import { getEventById } from "./events";

type RankedLeaderboardRow = LeaderboardRow & { teamId: string; teamCode: string; disqualified: boolean };

interface Aggregate {
  teamId: string;
  teamCode: string;
  teamName: string;
  college: string | null;
  status: string;
  finishedAt: number | null;
  questionsSolved: number;
  points: number;
  lastSolvedAt: number | null;
}

/** Ascending with nulls last. */
function nullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Compares the ranking keys only (no team name): 0 means the two teams share a rank. */
function compareKeys(mode: RankingMode, a: Aggregate, b: Aggregate): number {
  if (mode === "POINTS_THEN_TIME") {
    return (b.points - a.points) || nullsLast(a.lastSolvedAt, b.lastSolvedAt);
  }
  const aFinished = a.status === "FINISHED";
  const bFinished = b.status === "FINISHED";
  if (aFinished !== bFinished) return aFinished ? -1 : 1;
  return (aFinished ? nullsLast(a.finishedAt, b.finishedAt) : 0) ||
    (b.questionsSolved - a.questionsSolved) ||
    nullsLast(a.lastSolvedAt, b.lastSolvedAt);
}

function toRow(row: Aggregate, rank: number, forTeamId: string | undefined): RankedLeaderboardRow {
  return {
    rank,
    teamName: row.teamName,
    college: row.college,
    questionsSolved: row.questionsSolved,
    points: row.points,
    finished: row.status === "FINISHED",
    finishedAt: row.finishedAt,
    lastSolvedAt: row.lastSolvedAt,
    isYou: row.teamId === forTeamId,
    teamId: row.teamId,
    teamCode: row.teamCode,
    disqualified: row.status === "DISQUALIFIED",
  };
}

/**
 * Server-side ranking (contract §14.15). Counts solved questions, not completed ones, so a
 * team waiting for a code keeps credit and an admin unlock without a solve earns nothing.
 */
export async function computeLeaderboard(
  eventId: string,
  opts?: { forTeamId?: string; includeDisqualified?: boolean },
): Promise<{ mode: RankingMode; rows: RankedLeaderboardRow[] }> {
  const [event, aggregates] = await Promise.all([
    getEventById(eventId),
    getDb().select({
      teamId: ahTeams.id,
      teamCode: ahTeams.teamCode,
      teamName: ahTeams.teamName,
      college: ahTeams.college,
      status: ahTeams.status,
      finishedAt: ahTeams.finishedAt,
      questionsSolved: sql<number>`count(${ahStages.id})`,
      points: sql<number>`coalesce(sum(${ahStages.points}), 0)`,
      lastSolvedAt: sql<number | null>`max(${ahStageProgress.challengeSolvedAt})`,
    }).from(ahTeams)
      .leftJoin(ahStageProgress, and(
        eq(ahStageProgress.teamId, ahTeams.id),
        eq(ahStageProgress.challengeSolved, true),
      ))
      .leftJoin(ahStages, eq(ahStages.id, ahStageProgress.stageId))
      .where(eq(ahTeams.eventId, eventId))
      .groupBy(ahTeams.id),
  ]);
  const mode: RankingMode = event?.rankingMode === "POINTS_THEN_TIME" ? "POINTS_THEN_TIME" : "SOLVED_THEN_TIME";
  const all: Aggregate[] = aggregates.map((row) => ({
    ...row,
    questionsSolved: Number(row.questionsSolved),
    points: Number(row.points),
    lastSolvedAt: row.lastSolvedAt === null ? null : Number(row.lastSolvedAt),
  }));
  const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  // Ranking keys, then team name, then teamId so equal names still sort the same way every time.
  const byRank = (a: Aggregate, b: Aggregate) =>
    compareKeys(mode, a, b) || byText(a.teamName, b.teamName) || byText(a.teamId, b.teamId);

  const ranked = all.filter((row) => row.status !== "DISQUALIFIED").sort(byRank);
  const rows: RankedLeaderboardRow[] = [];
  ranked.forEach((row, index) => {
    const previous = ranked[index - 1];
    const rank = previous && compareKeys(mode, previous, row) === 0 ? rows[index - 1].rank : index + 1;
    rows.push(toRow(row, rank, opts?.forTeamId));
  });
  if (opts?.includeDisqualified) {
    for (const row of all.filter((r) => r.status === "DISQUALIFIED").sort(byRank)) {
      rows.push(toRow(row, 0, opts.forTeamId));
    }
  }
  return { mode, rows };
}
