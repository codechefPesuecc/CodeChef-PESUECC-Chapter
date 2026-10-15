process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahEvents, ahIntegrityEvents, ahTeams } from "@/server/db/schema";
import { AH_DEVICE_COOKIE } from "@/server/algohunt/devices";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { seedFixture, type Fixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, cookies, setTeamCookie } from "@/server/algohunt/testing/next-headers-mock";
import { POST } from "./route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

const LAPTOP_A = "11111111-1111-4111-8111-111111111111";
const LAPTOP_B = "22222222-2222-4222-8222-222222222222";

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return POST(new Request("https://chapter.example/api/algohunt/integrity", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }));
}

async function playAs(fixture: Fixture, deviceId = LAPTOP_A): Promise<void> {
  setTeamCookie(fixture.teams[0].team.id);
  (await cookies()).set(AH_DEVICE_COOKIE, deviceId);
}

async function episodes(teamId: string) {
  return getDb().select().from(ahIntegrityEvents).where(eq(ahIntegrityEvents.teamId, teamId));
}

describe("POST /api/algohunt/integrity", () => {
  it("requires a team session", async () => {
    const response = await post({ action: "leave", reasons: ["BLUR"] });
    expect(response.status).toBe(401);
  });

  it("records a leave with server-stamped times and closes it on return", async () => {
    const fixture = await seedFixture();
    await playAs(fixture);
    const leave = await post({ action: "leave", reasons: ["BLUR", "FULLSCREEN", "BLUR"] });
    expect(leave.status).toBe(200);
    const left = await leave.json() as { recorded: boolean; id: string; teamCount: number };
    expect(left).toMatchObject({ ok: true, recorded: true, teamCount: 1 });

    const [open] = await episodes(fixture.teams[0].team.id);
    expect(open).toMatchObject({ id: left.id, deviceId: LAPTOP_A, reasons: "FULLSCREEN,BLUR", returnedAt: null });

    const back = await (await post({ action: "return", id: left.id })).json() as { closed: boolean; awayMs: number };
    expect(back).toMatchObject({ ok: true, closed: true });
    const [closed] = await episodes(fixture.teams[0].team.id);
    expect(closed.returnedAt).toBeGreaterThanOrEqual(closed.leftAt);
    expect(back.awayMs).toBe(closed.returnedAt! - closed.leftAt);
    // A second return changes nothing.
    expect(await (await post({ action: "return", id: left.id })).json()).toMatchObject({ closed: false, awayMs: null });
  });

  it("counts every device of the team, and only the device that left can close its episode", async () => {
    const fixture = await seedFixture({ teams: 2 });
    await playAs(fixture, LAPTOP_A);
    const fromA = await (await post({ action: "leave", reasons: ["HIDDEN"] })).json() as { id: string };
    await playAs(fixture, LAPTOP_B);
    expect(await (await post({ action: "leave", reasons: ["HIDDEN"] })).json()).toMatchObject({ teamCount: 2 });
    expect(await (await post({ action: "return", id: fromA.id })).json()).toMatchObject({ closed: false });

    // Another team can't close it either.
    setTeamCookie(fixture.teams[1].team.id);
    (await cookies()).set(AH_DEVICE_COOKIE, LAPTOP_A);
    expect(await (await post({ action: "return", id: fromA.id })).json()).toMatchObject({ closed: false });
  });

  it("ignores away time when the team can't play", async () => {
    for (const setup of [
      { eventStatus: "PAUSED" as const },
      { eventStatus: "READY" as const },
      { teamStatus: "REGISTERED" as const },
      { teamStatus: "FINISHED" as const },
    ]) {
      await resetAlgoHuntTables();
      const fixture = await seedFixture(setup);
      await playAs(fixture);
      expect(await (await post({ action: "leave", reasons: ["BLUR"] })).json()).toEqual({ ok: true, recorded: false });
    }

    await resetAlgoHuntTables();
    const timeUp = await seedFixture();
    await getDb().update(ahEvents).set({ endsAt: Date.now() - 1 }).where(eq(ahEvents.id, timeUp.event.id));
    await playAs(timeUp);
    expect(await (await post({ action: "leave", reasons: ["BLUR"] })).json()).toMatchObject({ recorded: false });

    await getDb().update(ahEvents).set({ endsAt: null }).where(eq(ahEvents.id, timeUp.event.id));
    await getDb().update(ahTeams).set({ status: "DISQUALIFIED" }).where(eq(ahTeams.id, timeUp.teams[0].team.id));
    expect(await (await post({ action: "leave", reasons: ["BLUR"] })).json()).toMatchObject({ recorded: false });
    expect(await episodes(timeUp.teams[0].team.id)).toHaveLength(0);
  });

  it("gives a browser without a device cookie one", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    const response = await post({ action: "leave", reasons: ["BLUR"] });
    expect(response.headers.getSetCookie().some((c) => c.startsWith(`${AH_DEVICE_COOKIE}=`))).toBe(true);
  });

  it("rejects unknown reasons, extra fields, bad ids and cross-site requests", async () => {
    const fixture = await seedFixture();
    await playAs(fixture);
    expect((await post({ action: "leave", reasons: ["SCREENSHOT"] })).status).toBe(400);
    expect((await post({ action: "leave", reasons: [] })).status).toBe(400);
    expect((await post({ action: "leave", reasons: ["BLUR"], teamId: "x" })).status).toBe(400);
    expect((await post({ action: "return", id: "not-a-uuid" })).status).toBe(400);
    expect((await post({ action: "leave", reasons: ["BLUR"] }, { origin: "https://evil.example" })).status).toBe(403);
    expect(await episodes(fixture.teams[0].team.id)).toHaveLength(0);
  });

  it("rate limits a runaway client", async () => {
    const fixture = await seedFixture();
    await playAs(fixture);
    for (let i = 0; i < 60; i += 1) expect((await post({ action: "leave", reasons: ["BLUR"] })).status).toBe(200);
    expect((await post({ action: "leave", reasons: ["BLUR"] })).status).toBe(429);
  });
});
