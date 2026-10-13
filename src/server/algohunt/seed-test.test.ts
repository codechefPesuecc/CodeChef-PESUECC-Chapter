process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahChallenges, ahCodes, ahEvents, ahTeamMembers, ahTeams, ahTestCases } from "@/server/db/schema";
import { seedTestEvent } from "./seed-test";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

describe("seedTestEvent (Module 6 §5.4)", () => {
  it("seeds the canonical test event with 3 stages, 5 teams, and code batches", async () => {
    const result = await seedTestEvent();

    expect(result.event.slug).toBe("test-event-2026");
    expect(result.event.isTest).toBe(true);
    expect(result.event.status).toBe("READY");

    // 3 challenges
    expect(result.challenges).toHaveLength(3);
    expect(result.challenges.map((c) => c.slug)).toEqual([
      "tst-a-plus-b",
      "tst-max-array",
      "tst-count-vowels",
    ]);

    // Test cases in DB
    const db = getDb();
    const testCases = await db.select().from(ahTestCases);
    expect(testCases.length).toBeGreaterThan(15);

    // 3 stages
    expect(result.stages).toHaveLength(3);
    expect(result.stages[0].stageNumber).toBe(1);
    expect(result.stages[0].points).toBe(100);
    expect(result.stages[2].stageNumber).toBe(3);
    expect(result.stages[2].isFinal).toBe(true);
    expect(result.stages[2].points).toBe(300);

    // 5 teams
    expect(result.teams).toHaveLength(5);
    expect(result.teams[0].teamCode).toBe("TST-001");
    expect(result.teams[0].plainPassword).toHaveLength(8);
    expect(result.teams[4].teamCode).toBe("TST-005");

    const teamRows = await db.select().from(ahTeams).where(eq(ahTeams.eventId, result.event.id));
    expect(teamRows).toHaveLength(5);

    const members = await db.select().from(ahTeamMembers);
    expect(members.length).toBeGreaterThanOrEqual(10);

    // 3 code batches, 5 codes each
    expect(result.codeBatches).toHaveLength(3);
    expect(result.codeBatches[0].codes).toHaveLength(5);
    const codesInDb = await db.select().from(ahCodes).where(eq(ahCodes.eventId, result.event.id));
    expect(codesInDb).toHaveLength(15);
  });

  it("resets and re-seeds cleanly when run multiple times", async () => {
    await seedTestEvent();
    const secondRun = await seedTestEvent({ reset: true });

    expect(secondRun.event.slug).toBe("test-event-2026");
    expect(secondRun.teams).toHaveLength(5);

    const db = getDb();
    const events = await db.select().from(ahEvents).where(eq(ahEvents.slug, "test-event-2026"));
    expect(events).toHaveLength(1);

    const challenges = await db.select().from(ahChallenges).where(eq(ahChallenges.eventId, secondRun.event.id));
    expect(challenges).toHaveLength(3);
  });

  it("throws if reset is false and event already exists", async () => {
    await seedTestEvent();
    await expect(seedTestEvent({ reset: false })).rejects.toThrow(/already exists/i);
  });

  it("supports custom status (e.g. LIVE) and custom slug", async () => {
    const result = await seedTestEvent({
      slug: "live-test-hunt",
      name: "Live Test Hunt",
      eventStatus: "LIVE",
    });

    expect(result.event.slug).toBe("live-test-hunt");
    expect(result.event.status).toBe("LIVE");
    expect(result.event.startedAt).toBeDefined();
    expect(result.event.startedAt).not.toBeNull();
  });
});
