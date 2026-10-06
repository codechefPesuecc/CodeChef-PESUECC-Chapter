process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahEvents, ahStageProgress, ahStages, ahTeams } from "@/server/db/schema";
import { computeLeaderboard } from "./leaderboard";
import { adminCompleteStage, disqualifyTeam, redeemCode } from "./progression";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { ctxFor, seedFixture, solveCurrent, type Fixture } from "./testing/fixtures";

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

/** Solve the current question and, unless it's the final one, redeem the next unused code. */
async function advance(fixture: Fixture, teamIndex: number, stageIndex: number, code: { next: number }) {
  await solveCurrent(fixture, teamIndex);
  if (!fixture.stages[stageIndex].isFinal) {
    await redeemCode({
      ctx: ctxFor(fixture, teamIndex), stageId: fixture.stages[stageIndex].id,
      code: fixture.codes[code.next++].code,
    });
  }
}

async function setSolvedAt(fixture: Fixture, teamIndex: number, stageIndex: number, at: number) {
  await getDb().update(ahStageProgress).set({ challengeSolvedAt: at }).where(and(
    eq(ahStageProgress.teamId, fixture.teams[teamIndex].team.id),
    eq(ahStageProgress.stageId, fixture.stages[stageIndex].id),
  ));
}

async function setFinishedAt(fixture: Fixture, teamIndex: number, at: number) {
  await getDb().update(ahTeams).set({ finishedAt: at }).where(eq(ahTeams.id, fixture.teams[teamIndex].team.id));
}

const names = (rows: { teamName: string }[]) => rows.map((row) => row.teamName);

describe("computeLeaderboard", () => {
  it("9. SOLVED_THEN_TIME: finished first by finish time, then solved count, keeping CODE_PENDING credit", async () => {
    const fixture = await seedFixture({ teams: 4, codes: 12 });
    const code = { next: 0 };
    for (const team of [0, 1]) {
      for (const stage of [0, 1, 2]) await advance(fixture, team, stage, code);
    }
    await advance(fixture, 2, 0, code);
    await solveCurrent(fixture, 2); // Team 3: Question 2 solved, waiting for a code
    await advance(fixture, 3, 0, code); // Team 4: still solving Question 2
    await setFinishedAt(fixture, 0, 5_000);
    await setFinishedAt(fixture, 1, 4_000);
    await setSolvedAt(fixture, 2, 0, 1);
    await setSolvedAt(fixture, 2, 1, 2); // earliest solves of all, still below every finished team

    const { mode, rows } = await computeLeaderboard(fixture.event.id);
    expect(mode).toBe("SOLVED_THEN_TIME");
    expect(names(rows)).toEqual(["Team Beta", "Team Alpha", "Team 3", "Team 4"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(rows[0]).toMatchObject({ finished: true, finishedAt: 4_000, questionsSolved: 3 });
    expect(rows[2]).toMatchObject({ finished: false, questionsSolved: 2 });
    expect(rows[3]).toMatchObject({ questionsSolved: 1 });
  });

  it("9. SOLVED_THEN_TIME: equal solve counts order by the earlier last solve; zero-solved teams come last", async () => {
    const fixture = await seedFixture({ teams: 3 });
    await solveCurrent(fixture, 0);
    await solveCurrent(fixture, 1);
    await setSolvedAt(fixture, 0, 0, 200);
    await setSolvedAt(fixture, 1, 0, 100);
    const { rows } = await computeLeaderboard(fixture.event.id);
    expect(names(rows)).toEqual(["Team Beta", "Team Alpha", "Team 3"]);
    expect(rows[2]).toMatchObject({ rank: 3, questionsSolved: 0, points: 0, lastSolvedAt: null });
  });

  it("10. POINTS_THEN_TIME ranks by points of solved questions; admin unlocks earn nothing", async () => {
    const fixture = await seedFixture({ teams: 2 });
    const db = getDb();
    await db.update(ahStages).set({ points: 10 }).where(eq(ahStages.id, fixture.stages[0].id));
    await db.update(ahStages).set({ points: 50 }).where(eq(ahStages.id, fixture.stages[1].id));
    // Alpha moves past Question 1 by admin override, then solves Question 2 (50 points).
    await adminCompleteStage({
      eventId: fixture.event.id, teamId: fixture.teams[0].team.id, stageId: fixture.stages[0].id,
      adminId: "admin", reason: "Test override",
    });
    await solveCurrent(fixture, 0);
    await setSolvedAt(fixture, 0, 1, 300);
    // Beta solves Question 1 (10 points) earlier.
    await solveCurrent(fixture, 1);
    await setSolvedAt(fixture, 1, 0, 100);

    const bySolved = await computeLeaderboard(fixture.event.id);
    expect(names(bySolved.rows)).toEqual(["Team Beta", "Team Alpha"]);
    expect(bySolved.rows.map((row) => row.questionsSolved)).toEqual([1, 1]);

    await db.update(ahEvents).set({ rankingMode: "POINTS_THEN_TIME" }).where(eq(ahEvents.id, fixture.event.id));
    const byPoints = await computeLeaderboard(fixture.event.id);
    expect(byPoints.mode).toBe("POINTS_THEN_TIME");
    expect(names(byPoints.rows)).toEqual(["Team Alpha", "Team Beta"]);
    expect(byPoints.rows.map((row) => row.points)).toEqual([50, 10]);
  });

  it("11. excludes disqualified teams unless asked, then appends them with rank 0", async () => {
    const fixture = await seedFixture({ teams: 3 });
    await solveCurrent(fixture, 1);
    await disqualifyTeam({
      eventId: fixture.event.id, teamId: fixture.teams[1].team.id, adminId: "admin", reason: "Test disqualification",
    });
    const publicRows = (await computeLeaderboard(fixture.event.id)).rows;
    // Both remaining teams have 0 solved, so the team name breaks the tie ("Team 3" < "Team Alpha").
    expect(names(publicRows)).toEqual(["Team 3", "Team Alpha"]);
    expect(publicRows.every((row) => !row.disqualified)).toBe(true);

    const adminRows = (await computeLeaderboard(fixture.event.id, { includeDisqualified: true })).rows;
    expect(names(adminRows)).toEqual(["Team 3", "Team Alpha", "Team Beta"]);
    expect(adminRows[2]).toMatchObject({ rank: 0, disqualified: true, questionsSolved: 1 });
  });

  it("12. equal keys share a rank (1, 2, 2, 4) and isYou marks only the requesting team", async () => {
    const fixture = await seedFixture({ teams: 4, codes: 4 });
    await advance(fixture, 0, 0, { next: 0 });
    await solveCurrent(fixture, 0);
    for (const team of [1, 2]) {
      await solveCurrent(fixture, team);
      await setSolvedAt(fixture, team, 0, 500);
    }
    const { rows } = await computeLeaderboard(fixture.event.id, { forTeamId: fixture.teams[2].team.id });
    // Team 3 and Team Beta tie on every key; the name only orders them within the shared rank.
    expect(names(rows)).toEqual(["Team Alpha", "Team 3", "Team Beta", "Team 4"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 2, 4]);
    expect(rows.map((row) => row.isYou)).toEqual([false, true, false, false]);
    expect(rows[1]).toMatchObject({ teamId: fixture.teams[2].team.id, teamCode: "AH2-T003", disqualified: false });
  });
});
