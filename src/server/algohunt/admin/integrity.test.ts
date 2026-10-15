process.env.DATABASE_URL = ":memory:";

import crypto from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { GET as integrityRoute } from "@/app/api/admin/algohunt/integrity/route";
import { getDb } from "@/server/db";
import { ahEvents, ahIntegrityEvents, type AhEvent } from "@/server/db/schema";
import { recordDevice } from "../devices";
import { adminCompleteStage } from "../progression";
import { resetAlgoHuntTables, setupTestDb } from "../testing/db";
import { createSiteUser, ctxFor, seedFixture, type Fixture } from "../testing/fixtures";
import { clearCookies, setSiteSessionCookie, setTeamCookie } from "../testing/next-headers-mock";
import { describeUserAgent, getIntegrityOverview, INTEGRITY_THRESHOLDS } from "./integrity";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

const LAPTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

async function freshEvent(fixture: Fixture): Promise<AhEvent> {
  const [event] = await getDb().select().from(ahEvents).where(eq(ahEvents.id, fixture.event.id));
  return event;
}

function device(fixture: Fixture, teamIndex: number, deviceId: string, ua: string, now: number) {
  return recordDevice({
    ctx: ctxFor(fixture, teamIndex),
    deviceId,
    req: new Request("https://chapter.example/x", { headers: { "user-agent": ua, "x-forwarded-for": "198.51.100.4" } }),
    login: true,
    now,
  });
}

function away(fixture: Fixture, teamIndex: number, deviceId: string, leftAt: number, ms: number | null, reasons = "FULLSCREEN") {
  return getDb().insert(ahIntegrityEvents).values({
    id: crypto.randomUUID(),
    eventId: fixture.event.id,
    teamId: fixture.teams[teamIndex].team.id,
    deviceId,
    reasons,
    leftAt,
    returnedAt: ms === null ? null : leftAt + ms,
  });
}

describe("describeUserAgent", () => {
  it("names common browsers and systems", () => {
    expect(describeUserAgent(LAPTOP_UA)).toBe("Chrome on Windows");
    expect(describeUserAgent(PHONE_UA)).toBe("Chrome on Android");
    expect(describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"))
      .toBe("Safari on macOS");
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0")).toBe("Edge on Windows");
    expect(describeUserAgent(null)).toBe("Unknown browser");
  });
});

describe("getIntegrityOverview", () => {
  it("shows a clean team with no alerts", async () => {
    const fixture = await seedFixture();
    const event = await freshEvent(fixture);
    await device(fixture, 0, crypto.randomUUID(), LAPTOP_UA, event.startedAt!);
    await away(fixture, 0, "d", event.startedAt! + 1_000, 3_000);
    const overview = await getIntegrityOverview(event);
    expect(overview.teams[0]).toMatchObject({
      teamName: "Team Alpha",
      devices: [{ kind: "DESKTOP", browser: "Chrome on Windows", loginCount: 1, sharedWith: [] }],
      away: { count: 1, totalMs: 3_000, longestMs: 3_000, unreturned: 0 },
      alerts: [],
    });
  });

  it("flags phones, shared browsers, late devices and too many devices", async () => {
    const fixture = await seedFixture({ teams: 2 });
    const event = await freshEvent(fixture);
    const start = event.startedAt!;
    const shared = crypto.randomUUID();
    await device(fixture, 0, shared, LAPTOP_UA, start);
    await device(fixture, 1, shared, LAPTOP_UA, start);
    await device(fixture, 0, crypto.randomUUID(), PHONE_UA, start);
    await device(fixture, 0, crypto.randomUUID(), LAPTOP_UA, start + INTEGRITY_THRESHOLDS.newDeviceGraceMs + 1);
    for (let i = 0; i < 2; i += 1) await device(fixture, 0, crypto.randomUUID(), LAPTOP_UA, start);

    const overview = await getIntegrityOverview(event);
    const alpha = overview.teams.find((team) => team.teamName === "Team Alpha")!;
    expect(alpha.alerts.map((alert) => alert.kind)).toEqual(
      ["SHARED_DEVICE", "PHONE", "NEW_DEVICE_AFTER_START", "MANY_DEVICES"],
    );
    expect(alpha.alerts[0].message).toContain("Team Beta");
    const beta = overview.teams.find((team) => team.teamName === "Team Beta")!;
    expect(beta.alerts.map((alert) => alert.kind)).toEqual(["SHARED_DEVICE"]);
    expect(overview.totals).toMatchObject({ phones: 1, sharedDevices: 1, teamsWithAlerts: 2 });
    // Most serious first.
    expect(overview.teams[0].teamName).toBe("Team Alpha");
  });

  it("adds up away time, keeps unreturned stretches apart and names the question it happened on", async () => {
    const fixture = await seedFixture({ teams: 2 });
    const event = await freshEvent(fixture);
    const start = event.startedAt!;
    await away(fixture, 1, "d", start + 1_000, 30_000);
    await adminCompleteStage({
      eventId: event.id, teamId: fixture.teams[1].team.id, stageId: fixture.stages[0].id,
      adminId: "admin", reason: "Test progress",
    });
    const later = Date.now() + 1_000;
    await away(fixture, 1, "d", later, INTEGRITY_THRESHOLDS.longAwayMs);
    await away(fixture, 1, "d", later + 120_000, INTEGRITY_THRESHOLDS.totalAwayMs);
    await away(fixture, 1, "d", later + 900_000, null, "HIDDEN,BLUR");

    const overview = await getIntegrityOverview(event);
    const beta = overview.teams[0];
    expect(beta.teamName).toBe("Team Beta");
    expect(beta.away).toMatchObject({
      count: 4,
      totalMs: 30_000 + INTEGRITY_THRESHOLDS.longAwayMs + INTEGRITY_THRESHOLDS.totalAwayMs,
      longestMs: INTEGRITY_THRESHOLDS.totalAwayMs,
      unreturned: 1,
    });
    expect(beta.alerts.map((alert) => alert.kind)).toEqual(["TOTAL_AWAY", "LONG_AWAY"]);
    // Newest first, with the question each stretch happened on.
    expect(beta.away.episodes.map((episode) => [episode.questionNumber, episode.awayMs])).toEqual([
      [2, null], [2, INTEGRITY_THRESHOLDS.totalAwayMs], [2, INTEGRITY_THRESHOLDS.longAwayMs], [1, 30_000],
    ]);
    expect(beta.away.episodes[0].reasons).toEqual(["HIDDEN", "BLUR"]);
  });

  it("flags frequent leaving", async () => {
    const fixture = await seedFixture();
    const event = await freshEvent(fixture);
    for (let i = 0; i < INTEGRITY_THRESHOLDS.frequentAwayCount; i += 1) {
      await away(fixture, 0, "d", event.startedAt! + i * 10_000, 1_000);
    }
    const [team] = (await getIntegrityOverview(event)).teams;
    expect(team.alerts.map((alert) => alert.kind)).toEqual(["FREQUENT_AWAY"]);
  });
});

describe("GET /api/admin/algohunt/integrity", () => {
  const get = (slug?: string) => integrityRoute(new Request(
    `https://chapter.example/api/admin/algohunt/integrity${slug ? `?event=${slug}` : ""}`,
  ));

  it("is admins only", async () => {
    const fixture = await seedFixture();
    expect((await get(fixture.event.slug)).status).toBe(403);
    setTeamCookie(fixture.teams[0].team.id);
    expect((await get(fixture.event.slug)).status).toBe(403);
    const user = await createSiteUser({ isAdmin: false });
    setSiteSessionCookie(user.id);
    expect((await get(fixture.event.slug)).status).toBe(403);
  });

  it("returns the overview for the chosen event", async () => {
    const fixture = await seedFixture();
    const admin = await createSiteUser({ isAdmin: true });
    setSiteSessionCookie(admin.id);
    expect((await get()).status).toBe(400);
    expect((await get("no-such-event")).status).toBe(404);
    const response = await get(fixture.event.slug);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { ok: boolean; event: { slug: string }; teams: { teamName: string }[] };
    expect(body).toMatchObject({ ok: true, event: { slug: fixture.event.slug } });
    expect(body.teams.map((team) => team.teamName)).toEqual(["Team Alpha", "Team Beta"]);
  });
});
