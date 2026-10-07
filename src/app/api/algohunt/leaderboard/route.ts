import { NextResponse } from "next/server";
import type { LeaderboardRow, RankingMode } from "@/lib/algohunt/types";
import { fail, ok } from "@/server/algohunt/http";
import { computeLeaderboard } from "@/server/algohunt/leaderboard";
import { requireTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/** Public ranking for teams: server-ranked, never exposes teamId, teamCode or disqualified flags. */
export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await requireTeam();
    if (ctx instanceof NextResponse) return ctx;
    const updatedAt = Date.now();
    if (!ctx.event.leaderboardVisible) {
      const mode: RankingMode = ctx.event.rankingMode === "POINTS_THEN_TIME" ? "POINTS_THEN_TIME" : "SOLVED_THEN_TIME";
      return ok({ visible: false, mode, rows: [] as LeaderboardRow[], updatedAt }, NO_STORE);
    }
    const { mode, rows } = await computeLeaderboard(ctx.event.id, { forTeamId: ctx.team.id });
    const publicRows: LeaderboardRow[] = rows.map((row) => ({
      rank: row.rank,
      teamName: row.teamName,
      college: row.college,
      questionsSolved: row.questionsSolved,
      points: row.points,
      finished: row.finished,
      finishedAt: row.finishedAt,
      lastSolvedAt: row.lastSolvedAt,
      isYou: row.isYou,
    }));
    return ok({ visible: true, mode, rows: publicRows, updatedAt }, NO_STORE);
  } catch (error) {
    console.error("[algohunt:leaderboard]", error);
    return fail("INTERNAL");
  }
}
