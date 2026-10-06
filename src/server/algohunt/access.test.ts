process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahEvents, ahTeams } from "@/server/db/schema";
import { adminCompleteStage } from "./progression";
import { assertTeamCanPlay, canAccessStage, getTeamProgress } from "./access";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { ctxFor, seedFixture } from "./testing/fixtures";

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

describe("getTeamProgress", () => {
  it("exposes no question before LIVE", async () => {
    const fixture = await seedFixture({ eventStatus: "READY" });
    const progress = await getTeamProgress(ctxFor(fixture));
    expect(progress.current).toBeNull();
    expect(progress.stages.map((row) => row.state)).toEqual(["LOCKED", "LOCKED", "LOCKED"]);
  });

  it("exposes only Question 1 when LIVE", async () => {
    const fixture = await seedFixture();
    const progress = await getTeamProgress(ctxFor(fixture));
    expect(progress.current?.stage.stageNumber).toBe(1);
    expect(progress.stages.map((row) => row.state)).toEqual(["AVAILABLE", "LOCKED", "LOCKED"]);
    expect(canAccessStage(progress, 1)).toBe(true);
    expect(canAccessStage(progress, 2)).toBe(false);
  });

  it("locks completed questions and exposes the next one", async () => {
    const fixture = await seedFixture();
    await adminCompleteStage({
      eventId: fixture.event.id, teamId: fixture.teams[0].team.id, stageId: fixture.stages[0].id,
      adminId: "admin-1", reason: "Pool temporarily empty",
    });
    const progress = await getTeamProgress(ctxFor(fixture));
    expect(progress.stages.map((row) => row.state)).toEqual(["COMPLETED", "AVAILABLE", "LOCKED"]);
    expect(progress.current?.stage.stageNumber).toBe(2);
    expect(progress.completedCount).toBe(1);
  });

  it("has no current question for disqualified or registered teams", async () => {
    const fixture = await seedFixture();
    const db = getDb();
    await db.update(ahTeams).set({ status: "DISQUALIFIED" })
      .where(eq(ahTeams.id, fixture.teams[0].team.id));
    const [disqualified] = await db.select().from(ahTeams).where(eq(ahTeams.id, fixture.teams[0].team.id));
    expect((await getTeamProgress({ event: fixture.event, team: disqualified })).current).toBeNull();
    await db.update(ahTeams).set({ status: "REGISTERED" })
      .where(eq(ahTeams.id, fixture.teams[0].team.id));
    const [registered] = await db.select().from(ahTeams).where(eq(ahTeams.id, fixture.teams[0].team.id));
    expect((await getTeamProgress({ event: fixture.event, team: registered })).current).toBeNull();
  });
});

describe("assertTeamCanPlay", () => {
  it("returns the documented error priority", async () => {
    const fixture = await seedFixture();
    const db = getDb();
    const team = { ...fixture.teams[0].team, status: "DISQUALIFIED" };
    const event = { ...fixture.event, status: "ENDED", submissionsEnabled: false, codesEnabled: false };
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("EVENT_ENDED");
    event.status = "DRAFT";
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("EVENT_NOT_LIVE");
    event.status = "PAUSED";
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("EVENT_PAUSED");
    event.status = "LIVE";
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("TEAM_DISQUALIFIED");
    team.status = "REGISTERED";
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("TEAM_NOT_CHECKED_IN");
    team.status = "FINISHED";
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("TEAM_FINISHED");
    team.status = "CHECKED_IN";
    expect(assertTeamCanPlay({ team, event }, "submit")?.code).toBe("SUBMISSIONS_DISABLED");
    expect(assertTeamCanPlay({ team, event }, "code")?.code).toBe("CODES_DISABLED");
    await db.update(ahEvents).set({ submissionsEnabled: true, codesEnabled: true })
      .where(eq(ahEvents.id, fixture.event.id));
    expect(assertTeamCanPlay({ team, event: { ...event, submissionsEnabled: true, codesEnabled: true } }, "run"))
      .toBeNull();
  });
});
