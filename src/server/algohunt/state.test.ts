process.env.DATABASE_URL = ":memory:";

import crypto from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAnnouncements, ahChallenges, ahEvents, ahTeams } from "@/server/db/schema";
import { GET as stateRoute } from "@/app/api/algohunt/state/route";
import { disqualifyTeam, redeemCode } from "./progression";
import { buildParticipantState } from "./state";
import type { TeamContext } from "./teamSession";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture, solveCurrent, type Fixture } from "./testing/fixtures";
import { clearCookies, setTeamCookie } from "./testing/next-headers-mock";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

/** Seed with distinctive challenge titles so leak checks can't match the "Question N" copy. */
async function seed(opts: Parameters<typeof seedFixture>[0] = {}): Promise<Fixture> {
  const fixture = await seedFixture(opts);
  for (const [i, challenge] of fixture.challenges.entries()) {
    const title = `Secret Title ${i + 1}`;
    await getDb().update(ahChallenges).set({ title }).where(eq(ahChallenges.id, challenge.id));
    challenge.title = title;
  }
  return fixture;
}

/** Fresh team + event rows, as requireTeam() would load them. */
async function ctxOf(fixture: Fixture, teamIndex = 0): Promise<TeamContext> {
  const [row] = await getDb().select({ team: ahTeams, event: ahEvents })
    .from(ahTeams).innerJoin(ahEvents, eq(ahTeams.eventId, ahEvents.id))
    .where(eq(ahTeams.id, fixture.teams[teamIndex].team.id));
  return row;
}

async function setEventStatus(fixture: Fixture, status: EventStatus): Promise<void> {
  await getDb().update(ahEvents).set({ status }).where(eq(ahEvents.id, fixture.event.id));
}

describe("buildParticipantState", () => {
  it("1. shows no question before the start and locks every title", async () => {
    const fixture = await seed({ eventStatus: "READY" });
    const state = await buildParticipantState(await ctxOf(fixture));
    expect(state.current).toBeNull();
    expect(state.nextStep.kind).toBe("WAIT_FOR_START");
    expect(state.team.elapsedMs).toBeNull();
    expect(state.stages).toHaveLength(3);
    for (const stage of state.stages) expect(stage).toMatchObject({ state: "LOCKED", title: null });
  });

  it("2. opens Question 1 when the event is live and hides later titles", async () => {
    const fixture = await seed();
    const state = await buildParticipantState(await ctxOf(fixture));
    expect(state.current).toMatchObject({
      number: 1, state: "AVAILABLE", isFinal: false, challengeTitle: "Secret Title 1", challengeSolved: false,
    });
    expect(state.nextStep).toEqual({ kind: "SOLVE", message: "Solve Question 1." });
    expect(state.stages[0].title).toBe("Secret Title 1");
    expect(state.stages[1]).toMatchObject({ number: 2, state: "LOCKED", title: null });
    expect(state.stages[2]).toMatchObject({ number: 3, state: "LOCKED", title: null });
    expect(state.solvedCount).toBe(0);
    expect(state.totalStages).toBe(3);
    expect(state.team.elapsedMs).toBeGreaterThanOrEqual(60_000);
  });

  it("3. asks for a QR code once Question 1 is solved", async () => {
    const fixture = await seed();
    await solveCurrent(fixture);
    const state = await buildParticipantState(await ctxOf(fixture));
    expect(state.current).toMatchObject({ number: 1, state: "CODE_PENDING", challengeSolved: true });
    expect(state.nextStep.kind).toBe("FIND_CODE");
    expect(state.nextStep.message).toContain("Question 2");
    expect(state.solvedCount).toBe(1);
    expect(state.stages[0].solvedAt).not.toBeNull();
    expect(state.stages[1].title).toBeNull();
  });

  it("4. moves to Question 2 after a code is redeemed and keeps Question 1 as history", async () => {
    const fixture = await seed();
    await solveCurrent(fixture);
    await redeemCode({ ctx: await ctxOf(fixture), stageId: fixture.stages[0].id, code: fixture.codes[0].code });
    const state = await buildParticipantState(await ctxOf(fixture));
    expect(state.current).toMatchObject({ number: 2, state: "AVAILABLE" });
    expect(state.stages[0]).toMatchObject({ state: "COMPLETED", title: "Secret Title 1" });
    expect(state.stages[0].completedAt).not.toBeNull();
    expect(state.stages[1].title).toBe("Secret Title 2");
    expect(state.stages[2].title).toBeNull();
    expect(state.nextStep).toEqual({ kind: "SOLVE", message: "Solve Question 2." });
  });

  it("5. finishes on the final question with a frozen elapsed time", async () => {
    const fixture = await seed({ stages: 1 });
    const before = await buildParticipantState(await ctxOf(fixture));
    expect(before.current?.isFinal).toBe(true);
    expect(before.nextStep.message).toBe("Solve the FINAL question to finish AlgoHunt 2.0. No code needed.");

    await solveCurrent(fixture);
    const ctx = await ctxOf(fixture);
    const state = await buildParticipantState(ctx);
    expect(state.nextStep.kind).toBe("FINISHED");
    expect(state.current).toBeNull();
    expect(state.team.status).toBe("FINISHED");
    expect(state.team.finishedAt).not.toBeNull();
    expect(state.team.elapsedMs).toBe(ctx.team.finishedAt! - ctx.event.startedAt!);
  });

  it("6. reports pause, missing check-in and disqualification", async () => {
    const paused = await seed({ eventStatus: "PAUSED" });
    expect((await buildParticipantState(await ctxOf(paused))).nextStep.kind).toBe("PAUSED");

    await resetAlgoHuntTables();
    const registered = await seed({ teamStatus: "REGISTERED" });
    const notCheckedIn = await buildParticipantState(await ctxOf(registered));
    expect(notCheckedIn.nextStep.kind).toBe("NOT_CHECKED_IN");
    expect(notCheckedIn.current).toBeNull();
    expect(notCheckedIn.stages.every((stage) => stage.title === null)).toBe(true);

    await resetAlgoHuntTables();
    const dq = await seed();
    await disqualifyTeam({
      eventId: dq.event.id, teamId: dq.teams[0].team.id, adminId: "admin", reason: "Test disqualification",
    });
    await setEventStatus(dq, "ENDED");
    const disqualified = await buildParticipantState(await ctxOf(dq));
    expect(disqualified.nextStep.kind).toBe("DISQUALIFIED");
    expect(disqualified.current).toBeNull();
  });

  it("hides the current question once the event has ended", async () => {
    const fixture = await seed();
    await setEventStatus(fixture, "ENDED");
    const state = await buildParticipantState(await ctxOf(fixture));
    expect(state.nextStep.kind).toBe("ENDED");
    expect(state.current).toBeNull();
  });

  it("7. includes only active announcements, at most 5, newest first", async () => {
    const fixture = await seed();
    const other = await seedFixture({ teams: 1 });
    const db = getDb();
    const base = Date.now();
    for (let i = 1; i <= 7; i += 1) {
      await db.insert(ahAnnouncements).values({
        id: crypto.randomUUID(), eventId: fixture.event.id, message: `Notice ${i}`,
        priority: i === 7 ? "CRITICAL" : "INFO", active: i !== 6, createdBy: "admin", createdAt: base + i,
      });
    }
    await db.insert(ahAnnouncements).values({
      id: crypto.randomUUID(), eventId: other.event.id, message: "Other event",
      createdBy: "admin", createdAt: base + 100,
    });
    const state = await buildParticipantState(await ctxOf(fixture));
    expect(state.announcements.map((a) => a.message)).toEqual([
      "Notice 7", "Notice 5", "Notice 4", "Notice 3", "Notice 2",
    ]);
    expect(state.announcements[0]).toMatchObject({ priority: "CRITICAL", createdAt: base + 7 });
    expect(Object.keys(state.announcements[0]).sort()).toEqual(["createdAt", "id", "message", "priority"]);
  });

  it("8. never leaks pool codes, future titles, secrets or another team's data", async () => {
    const fixture = await seed();
    await solveCurrent(fixture);
    await solveCurrent(fixture, 1);
    const json = JSON.stringify(await buildParticipantState(await ctxOf(fixture)));
    for (const code of fixture.codes) expect(json).not.toContain(code.code);
    expect(json).not.toContain("Secret Title 2");
    expect(json).not.toContain("Secret Title 3");
    const teamB = fixture.teams[1].team;
    for (const value of [teamB.id, teamB.teamCode, teamB.teamName, fixture.teams[0].team.id]) {
      expect(json).not.toContain(value);
    }
    for (const secret of [fixture.teams[0].team.passwordHash, "passwordHash", "#include", "referenceSolution"]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("GET /api/algohunt/state", () => {
  it("requires a team session", async () => {
    const response = await stateRoute();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("returns the participant state with no-store caching", async () => {
    const fixture = await seed();
    setTeamCookie(fixture.teams[0].team.id);
    const response = await stateRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, team: { code: "AH2-T001" }, current: { number: 1 } });
  });

  it("rate limits runaway polling with RATE_LIMITED", async () => {
    const fixture = await seed();
    setTeamCookie(fixture.teams[0].team.id);
    for (let i = 0; i < 240; i += 1) expect((await stateRoute()).status).toBe(200);
    const limited = await stateRoute();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
    expect(await limited.json()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});
