process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents } from "@/server/db/schema";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { seedFixture } from "@/server/algohunt/testing/fixtures";
import { POST } from "./route";

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

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
