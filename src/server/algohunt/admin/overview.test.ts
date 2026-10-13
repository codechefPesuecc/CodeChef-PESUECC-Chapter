process.env.DATABASE_URL = ":memory:";

import crypto from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { judgeHealth } from "@/lib/judge";
import { getDb } from "@/server/db";
import { ahCodeAttempts, ahCodes, ahSubmissions } from "@/server/db/schema";
import { adminCompleteStage, disqualifyTeam, redeemCode } from "../progression";
import { resetAlgoHuntTables, setupTestDb } from "../testing/db";
import { createSiteUser, ctxFor, seedFixture, solveCurrent, type Fixture } from "../testing/fixtures";
import { getOverview } from "./overview";

vi.mock("@/lib/judge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/judge")>()),
  judgeHealth: vi.fn(),
}));

const SOURCE_MARKER = "int main() { /* overview-secret-source */ }";

beforeAll(setupTestDb);
beforeEach(async () => {
  await resetAlgoHuntTables();
  vi.mocked(judgeHealth).mockResolvedValue({
    total_workers: 8, idle_workers: 6, busy_workers: 2, queued_jobs: 0, uptime_secs: 100,
  });
});

/** 3 teams: Alpha finished (1 code used, 1 override), Beta disqualified, Team 3 waiting for a code. */
async function seedEventDay(): Promise<{ fixture: Fixture; admin: { id: string; username: string } }> {
  const fixture = await seedFixture({ teams: 3, stages: 3, codes: 8 });
  const admin = await createSiteUser({ isAdmin: true, username: `aniket-${crypto.randomUUID().slice(0, 8)}` });
  const [alpha, beta, third] = fixture.teams.map((t) => t.team);
  const [q1, q2, q3] = fixture.stages;

  await solveCurrent(fixture, 0);
  expect((await redeemCode({ ctx: ctxFor(fixture, 0), stageId: q1.id, code: fixture.codes[0].code })).outcome).toBe("UNLOCKED");
  await solveCurrent(fixture, 0);
  expect(await adminCompleteStage({
    eventId: fixture.event.id, teamId: alpha.id, stageId: q2.id, adminId: admin.id, reason: "QR pool empty",
  })).toMatchObject({ ok: true, changed: true });
  await solveCurrent(fixture, 0);

  await disqualifyTeam({ eventId: fixture.event.id, teamId: beta.id, adminId: admin.id, reason: "shared answers" });
  await solveCurrent(fixture, 2);

  const now = Date.now();
  const submission = (teamId: string, stageId: string, challengeId: string, status: string, verdict: string | null, ago: number) => ({
    id: crypto.randomUUID(), eventId: fixture.event.id, teamId, stageId, challengeId, language: "cpp",
    code: SOURCE_MARKER, status, verdict, failedOn: verdict && verdict !== "AC" ? 3 : null,
    createdAt: now - ago, finishedAt: status === "DONE" || status === "FAILED" ? now - ago + 500 : null,
  });
  const [c1, , c3] = fixture.challenges.map((c) => c.id);
  await getDb().insert(ahSubmissions).values([
    submission(alpha.id, q1.id, c1, "DONE", "AC", 50_000),
    submission(alpha.id, q3.id, c3, "DONE", "AC", 40_000),
    submission(third.id, q1.id, c1, "DONE", "WA", 30_000),
    submission(beta.id, q1.id, c1, "DONE", "TLE", 20_000),
    submission(third.id, q1.id, c1, "FAILED", null, 10_000),
  ]);

  const attempt = (teamId: string, ago: number) => ({
    id: crypto.randomUUID(), eventId: fixture.event.id, teamId, stageId: q1.id,
    submittedCode: fixture.codes[5].code, result: "INVALID", createdAt: now - ago,
  });
  await getDb().insert(ahCodeAttempts).values([
    ...Array.from({ length: 5 }, (_, i) => attempt(third.id, 1_000 * (i + 1))),
    ...Array.from({ length: 4 }, (_, i) => attempt(beta.id, 1_000 * (i + 1))),
  ]);
  return { fixture, admin };
}

describe("getOverview", () => {
  it("matches the event-day fixture", async () => {
    const { fixture } = await seedEventDay();
    const overview = await getOverview(fixture.event);

    expect(overview.counts).toEqual({
      teamsTotal: 3, registered: 0, checkedIn: 3, finished: 1, disqualified: 1,
      submissions: 5, accepted: 2, rejected: 2, judgeErrors10m: 1, suspiciousCodeTeams10m: 1,
    });
    expect(overview.codePool).toMatchObject({ total: 8, active: 7, used: 1, teamsWaitingForCode: 1, lowPool: false });
    expect(overview.stuck).toEqual([expect.objectContaining({
      teamId: fixture.teams[2].team.id, teamCode: "AH2-T003", stageNumber: 1,
    })]);
    expect(overview.stuck[0].waitingSinceMs).toBeGreaterThanOrEqual(0);
    expect(overview.readiness).toEqual({
      stages: 3, challengesUnverified: 3, finalStageOk: true, activeCodes: 7, checkedInTeams: 3,
    });
    expect(overview.topTeams[0]).toMatchObject({ rank: 1, teamCode: "AH2-T001", questionsSolved: 3 });
    expect(overview.topTeams.map((t) => t.teamCode)).not.toContain("AH2-T002");
    expect(overview.health).toMatchObject({ judge: { ok: true, idle: 6, busy: 2, queued: 0, workers: 8 }, db: { ok: true } });
  });

  it("explains recent activity without leaking codes or source", async () => {
    const { fixture, admin } = await seedEventDay();
    const overview = await getOverview(fixture.event);
    const texts = overview.recentActivity.map((a) => a.text);

    expect(texts).toContain("Team Alpha unlocked Question 2 with code #001");
    expect(texts).toContain(`${admin.username} unlocked Question 3 for Team Alpha without a code: 'QR pool empty'`);
    expect(texts).toContain("Team 3 got WA on Question 1 (test 3)");
    // One line per event: the engine's stage.completed twin of a code or override unlock is skipped.
    expect(texts).not.toContain("Team Alpha completed Question 1 with code #001");
    expect(texts.some((t) => t.includes("completed Question 2 by admin override"))).toBe(false);
    expect(overview.recentActivity.length).toBeLessThanOrEqual(40);
    const times = overview.recentActivity.map((a) => a.at);
    expect(times).toEqual([...times].sort((a, b) => b - a));

    const json = JSON.stringify(overview);
    for (const code of fixture.codes) expect(json).not.toContain(code.code);
    expect(json).not.toContain(SOURCE_MARKER);
  });

  it("flags a low pool when few codes are left or more teams wait than codes exist", async () => {
    const { fixture } = await seedEventDay();
    await getDb().update(ahCodes).set({ status: "DISABLED" })
      .where(inArray(ahCodes.id, fixture.codes.slice(1, 4).map((c) => c.id)));
    const low = await getOverview(fixture.event);
    expect(low.codePool).toMatchObject({ active: 4, lowPool: true });

    await getDb().update(ahCodes).set({ status: "DISABLED" }).where(eq(ahCodes.eventId, fixture.event.id));
    const empty = await getOverview(fixture.event);
    expect(empty.codePool).toMatchObject({ active: 0, teamsWaitingForCode: 1, lowPool: true });
  });

  it("reports an unreachable judge without details", async () => {
    vi.mocked(judgeHealth).mockRejectedValue(new Error("connect ECONNREFUSED http://judge.internal:2000"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fixture = await seedFixture();
    const overview = await getOverview(fixture.event);
    expect(overview.health.judge).toEqual({ ok: false, error: "Judge unreachable" });
    consoleError.mockRestore();
  });
});
