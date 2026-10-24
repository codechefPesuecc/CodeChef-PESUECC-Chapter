process.env.DATABASE_URL = ":memory:";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createSessionToken } from "@/server/auth/token";
import { getDb } from "@/server/db";
import { ahEvents, ahTeams } from "@/server/db/schema";
import { clearCookies, setTeamCookie } from "./testing/next-headers-mock";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture } from "./testing/fixtures";
import { createTeamToken, generateTeamPassword, getCurrentTeam, readTeamToken } from "./teamSession";

vi.mock("next/headers", () => import("./testing/next-headers-mock"));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("team tokens", () => {
  it("round trips the team id and epoch", () => {
    expect(readTeamToken(createTeamToken("team-1", 4))).toEqual({ teamId: "team-1", epoch: 4 });
  });

  it("rejects a changed payload", () => {
    const token = createTeamToken("team-1", 4);
    expect(readTeamToken(token.replace("team-1", "team-2"))).toBeNull();
  });

  it("rejects a changed signature", () => {
    const token = createTeamToken("team-1", 4);
    expect(readTeamToken(`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T00:00:00.000Z"));
    const token = createTeamToken("team-1", 4);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(readTeamToken(token)).toBeNull();
  });

  it("does not accept a site arena session", () => {
    expect(readTeamToken(createSessionToken("user-1", 4))).toBeNull();
  });
});

describe("generateTeamPassword", () => {
  it("generates ten characters from the permitted alphabet", () => {
    expect(generateTeamPassword()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
  });
});

describe("getCurrentTeam", () => {
  it("loads a valid team and event", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    expect((await getCurrentTeam())?.team.id).toBe(fixture.teams[0].team.id);
  });

  it("rejects an old session epoch", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    await getDb().update(ahTeams).set({ sessionEpoch: 1 })
      .where(eq(ahTeams.id, fixture.teams[0].team.id));
    expect(await getCurrentTeam()).toBeNull();
  });

  it("rejects an archived event", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    await getDb().update(ahEvents).set({ status: "ARCHIVED" })
      .where(eq(ahEvents.id, fixture.event.id));
    expect(await getCurrentTeam()).toBeNull();
  });
});
