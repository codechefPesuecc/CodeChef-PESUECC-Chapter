process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents } from "@/server/db/schema";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { seedFixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setTeamCookie } from "@/server/algohunt/testing/next-headers-mock";
import { POST as logout } from "../logout/route";
import { GET as me } from "../me/route";
import { POST } from "./route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function login(teamCode: string, password: string, extra?: Record<string, unknown>) {
  return POST(new Request("https://chapter.example/api/algohunt/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.7" },
    body: JSON.stringify({ teamCode, password, ...extra }),
  }));
}

describe("team login route", () => {
  it("sets an HttpOnly team cookie on success", async () => {
    const fixture = await seedFixture();
    const response = await login(fixture.teams[0].team.teamCode, fixture.teams[0].password);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("ah_team=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.json()).toMatchObject({
      ok: true, team: { code: "AH2-T001", name: "Team Alpha" },
    });
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "team.login"));
    expect(audits).toHaveLength(1);
    expect(audits[0].teamId).toBe(fixture.teams[0].team.id);
  });

  it("uses the same response for a wrong password and unknown team code", async () => {
    const fixture = await seedFixture();
    const wrong = await login(fixture.teams[0].team.teamCode, "wrong-password");
    const unknown = await login("AH2-T999", "wrong-password");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "team.login_failed"));
    expect(audits).toHaveLength(2);
    expect(audits.every((row) => !row.metadata.includes("wrong-password"))).toBe(true);
  });

  it("rate limits the eleventh attempt for one team code", async () => {
    const fixture = await seedFixture();
    const code = fixture.teams[0].team.teamCode;
    for (let i = 0; i < 10; i += 1) {
      expect((await login(code, "wrong-password")).status).toBe(401);
    }
    const response = await login(code, "wrong-password");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(await response.json()).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("does not log in to an archived event", async () => {
    const fixture = await seedFixture();
    await getDb().update(ahEvents).set({ status: "ARCHIVED" })
      .where(eq(ahEvents.id, fixture.event.id));
    const response = await login(fixture.teams[0].team.teamCode, fixture.teams[0].password);
    expect(response.status).toBe(401);
  });

  it("rejects an extra field", async () => {
    const fixture = await seedFixture();
    const response = await login(fixture.teams[0].team.teamCode, fixture.teams[0].password, { teamId: "forged" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION" });
  });
});

describe("team session routes", () => {
  it("returns the team, event and server time for a valid session", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    const response = await me();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      team: { code: fixture.teams[0].team.teamCode, name: fixture.teams[0].team.teamName, status: "CHECKED_IN" },
      event: { name: fixture.event.name, status: "LIVE" },
      serverNow: expect.any(Number),
    });
  });

  it("rejects an absent session", async () => {
    expect((await me()).status).toBe(401);
  });

  it("deletes the team cookie and audits logout", async () => {
    const fixture = await seedFixture();
    setTeamCookie(fixture.teams[0].team.id);
    const response = await logout(new Request("https://chapter.example/api/algohunt/auth/logout", {
      method: "POST", headers: { origin: "https://chapter.example" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/ah_team=;.*Expires=Thu, 01 Jan 1970/);
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "team.logout"));
    expect(audits).toHaveLength(1);
    expect(audits[0].teamId).toBe(fixture.teams[0].team.id);
  });

  it("blocks a cross-origin logout without deleting the cookie", async () => {
    const response = await logout(new Request("https://chapter.example/api/algohunt/auth/logout", {
      method: "POST", headers: { origin: "https://another.example" },
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
