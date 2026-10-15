process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST as login } from "@/app/api/algohunt/auth/login/route";
import { GET as stateRoute } from "@/app/api/algohunt/state/route";
import { getDb } from "@/server/db";
import { ahTeamDevices } from "@/server/db/schema";
import { AH_DEVICE_COOKIE, DEVICE_TOUCH_INTERVAL_MS, deviceKind, recordDevice } from "./devices";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { ctxFor, seedFixture } from "./testing/fixtures";
import { clearCookies, cookies, setTeamCookie } from "./testing/next-headers-mock";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

const LAPTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function loginRequest(teamCode: string, password: string, userAgent = LAPTOP_UA, ip = "198.51.100.4"): Request {
  return new Request("https://chapter.example/api/algohunt/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent, "x-forwarded-for": ip },
    body: JSON.stringify({ teamCode, password }),
  });
}

function deviceCookieFrom(response: Response): string | null {
  const match = response.headers.get("set-cookie")?.match(new RegExp(`${AH_DEVICE_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

async function devicesOf(teamId: string) {
  return getDb().select().from(ahTeamDevices).where(eq(ahTeamDevices.teamId, teamId));
}

describe("deviceKind", () => {
  it("tells laptops from phones and tablets", () => {
    expect(deviceKind(new Headers({ "user-agent": LAPTOP_UA }))).toBe("DESKTOP");
    expect(deviceKind(new Headers({ "user-agent": PHONE_UA }))).toBe("MOBILE");
    expect(deviceKind(new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }))).toBe("MOBILE");
    expect(deviceKind(new Headers({ "user-agent": LAPTOP_UA, "sec-ch-ua-mobile": "?1" }))).toBe("MOBILE");
  });
});

describe("device tracking on login", () => {
  it("gives a new browser an HttpOnly device cookie and records it", async () => {
    const fixture = await seedFixture();
    const { team, password } = fixture.teams[0];
    const response = await login(loginRequest(team.teamCode, password));
    expect(response.status).toBe(200);
    const deviceId = deviceCookieFrom(response);
    expect(deviceId).toMatch(/^[0-9a-f-]{36}$/);
    const deviceCookie = response.headers.getSetCookie().find((c) => c.startsWith(`${AH_DEVICE_COOKIE}=`));
    expect(deviceCookie).toMatch(/HttpOnly/i);
    expect(deviceCookie).toMatch(/SameSite=lax/i);
    const [device] = await devicesOf(team.id);
    expect(device).toMatchObject({
      deviceId, kind: "DESKTOP", firstIp: "198.51.100.4", lastIp: "198.51.100.4", loginCount: 1,
    });
  });

  it("counts repeat logins from the same browser on one row and records phones as MOBILE", async () => {
    const fixture = await seedFixture();
    const { team, password } = fixture.teams[0];
    const first = await login(loginRequest(team.teamCode, password));
    (await cookies()).set(AH_DEVICE_COOKIE, deviceCookieFrom(first)!);
    const second = await login(loginRequest(team.teamCode, password, LAPTOP_UA, "198.51.100.9"));
    expect(deviceCookieFrom(second)).toBeNull();
    clearCookies();
    await login(loginRequest(team.teamCode, password, PHONE_UA));

    const devices = await devicesOf(team.id);
    expect(devices).toHaveLength(2);
    const laptop = devices.find((device) => device.kind === "DESKTOP");
    expect(laptop).toMatchObject({ loginCount: 2, firstIp: "198.51.100.4", lastIp: "198.51.100.9" });
    expect(devices.find((device) => device.kind === "MOBILE")?.loginCount).toBe(1);
  });

  it("does not record failed logins", async () => {
    const fixture = await seedFixture();
    const response = await login(loginRequest(fixture.teams[0].team.teamCode, "wrong-password"));
    expect(response.status).toBe(401);
    expect(deviceCookieFrom(response)).toBeNull();
    expect(await devicesOf(fixture.teams[0].team.id)).toHaveLength(0);
  });

  it("keeps one row per team when a browser is used by two teams", async () => {
    const fixture = await seedFixture({ teams: 2 });
    const first = await login(loginRequest(fixture.teams[0].team.teamCode, fixture.teams[0].password));
    const deviceId = deviceCookieFrom(first)!;
    (await cookies()).set(AH_DEVICE_COOKIE, deviceId);
    await login(loginRequest(fixture.teams[1].team.teamCode, fixture.teams[1].password));
    const rows = await getDb().select().from(ahTeamDevices).where(eq(ahTeamDevices.deviceId, deviceId));
    expect(rows.map((row) => row.teamId).sort()).toEqual(
      [fixture.teams[0].team.id, fixture.teams[1].team.id].sort(),
    );
  });
});

describe("device tracking on polls", () => {
  it("records a browser that has no device cookie yet and sets one", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    const response = await stateRoute(new Request("https://chapter.example/api/algohunt/state", {
      headers: { "user-agent": LAPTOP_UA, "x-forwarded-for": "198.51.100.4" },
    }));
    expect(response.status).toBe(200);
    const deviceId = deviceCookieFrom(response);
    expect(deviceId).not.toBeNull();
    expect(await devicesOf(fixture.teams[0].team.id)).toMatchObject([{ deviceId, loginCount: 0 }]);
  });

  it("refreshes lastSeenAt at most once a minute", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    const req = new Request("https://chapter.example/x", { headers: { "user-agent": LAPTOP_UA } });
    const deviceId = crypto.randomUUID();
    const t0 = 1_800_000_000_000;
    await recordDevice({ ctx, deviceId, req, now: t0 });
    await recordDevice({ ctx, deviceId, req, now: t0 + DEVICE_TOUCH_INTERVAL_MS - 1 });
    expect((await devicesOf(fixture.teams[0].team.id))[0].lastSeenAt).toBe(t0);
    await recordDevice({ ctx, deviceId, req, now: t0 + DEVICE_TOUCH_INTERVAL_MS + 1 });
    const [device] = await devicesOf(fixture.teams[0].team.id);
    expect(device.lastSeenAt).toBe(t0 + DEVICE_TOUCH_INTERVAL_MS + 1);
    expect(device.firstSeenAt).toBe(t0);
    expect(device.loginCount).toBe(0);
  });
});
