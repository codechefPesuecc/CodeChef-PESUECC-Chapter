process.env.DATABASE_URL = ":memory:";

import crypto from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMeRoute } from "@/app/api/algohunt/volunteer/me/route";
import { GET as getTeamRoute } from "@/app/api/algohunt/volunteer/team/route";
import { POST as postCheckinRoute } from "@/app/api/algohunt/volunteer/checkin/route";
import { getDb } from "@/server/db";
import { ahTeamMembers, users } from "@/server/db/schema";
import { assignVolunteer, removeVolunteer } from "./volunteers";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture } from "./testing/fixtures";
import type { SessionUser } from "@/server/auth/session";

let mockUser: SessionUser | null = null;
let mockAdmin: SessionUser | null = null;

vi.mock("@/server/auth/session", () => ({
  getCurrentUser: async () => mockUser,
  getAdminUser: async () => mockAdmin,
}));

beforeAll(setupTestDb);
beforeEach(async () => {
  mockUser = null;
  mockAdmin = null;
  await resetAlgoHuntTables();
});

function createMockUser(opts: { id: string; username: string; isAdmin?: boolean }): SessionUser {
  return {
    id: opts.id,
    username: opts.username,
    name: "Test User",
    email: `${opts.username}@example.com`,
    emailVerified: true,
    phone: "9876543210",
    srn: null,
    prn: "PRN001",
    isAdmin: opts.isAdmin ?? false,
    isTeacher: false,
    createdAt: Date.now(),
  };
}

describe("AlgoHunt Volunteers & Check-in Desk (Module 3)", () => {
  // Test 17
  it("17. A non-volunteer site user -> FORBIDDEN on volunteer routes. A team cookie only -> 401. An admin passes. volunteer/team returns member names but no emails or phones.", async () => {
    const fixture = await seedFixture({ teams: 1, teamStatus: "REGISTERED" });
    const db = getDb();
    const team = fixture.teams[0].team;

    // Seed team member with email and phone
    await db.insert(ahTeamMembers).values({
      id: crypto.randomUUID(),
      teamId: team.id,
      name: "Alice Smith",
      email: "alice@secret.com",
      phone: "+919999999999",
      isCaptain: true,
      createdAt: Date.now(),
    });

    // 1. Team cookie only (no site user session) -> 401 UNAUTHENTICATED
    mockUser = null;
    mockAdmin = null;

    const resMeAnon = await getMeRoute();
    expect(resMeAnon.status).toBe(401);

    const reqTeamAnon = new Request(`http://localhost/api/algohunt/volunteer/team?code=${team.teamCode}`);
    const resTeamAnon = await getTeamRoute(reqTeamAnon);
    expect(resTeamAnon.status).toBe(401);

    const reqCheckinAnon = new Request("http://localhost/api/algohunt/volunteer/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamCode: team.teamCode }),
    });
    const resCheckinAnon = await postCheckinRoute(reqCheckinAnon);
    expect(resCheckinAnon.status).toBe(401);

    // 2. Non-volunteer site user -> 403 FORBIDDEN
    const regularUser = createMockUser({ id: "user-reg", username: "regular_joe", isAdmin: false });
    mockUser = regularUser;

    const resMeReg = await getMeRoute();
    expect(resMeReg.status).toBe(403);

    const resTeamReg = await getTeamRoute(reqTeamAnon);
    expect(resTeamReg.status).toBe(403);

    const resCheckinReg = await postCheckinRoute(reqCheckinAnon);
    expect(resCheckinReg.status).toBe(403);

    // 3. Admin passes even without a volunteer row
    const adminUser = createMockUser({ id: "admin-1", username: "admin", isAdmin: true });
    mockUser = adminUser;
    mockAdmin = adminUser;

    const resMeAdmin = await getMeRoute();
    expect(resMeAdmin.status).toBe(200);
    const meJson = await resMeAdmin.json() as { ok: boolean; volunteer: { isAdmin: boolean } };
    expect(meJson.ok).toBe(true);
    expect(meJson.volunteer.isAdmin).toBe(true);

    // 4. volunteer/team returns member names but NO email or phone
    const resTeamAdmin = await getTeamRoute(reqTeamAnon);
    expect(resTeamAdmin.status).toBe(200);
    const teamJson = await resTeamAdmin.json() as {
      ok: boolean;
      team: { code: string; name: string; members: string[]; email?: string; phone?: string };
    };
    expect(teamJson.ok).toBe(true);
    expect(teamJson.team.code).toBe(team.teamCode);
    expect(teamJson.team.members).toContain("Alice Smith");

    // Strictly ensure no private info leaked
    const jsonStr = JSON.stringify(teamJson);
    expect(jsonStr).not.toContain("alice@secret.com");
    expect(jsonStr).not.toContain("+919999999999");

    // 5. Assign volunteer and test regular volunteer user passes
    await db.insert(users).values({
      id: regularUser.id,
      username: regularUser.username,
      email: regularUser.email,
      prn: regularUser.prn,
      passwordHash: "hash",
      sessionEpoch: 0,
      createdAt: Date.now(),
    });

    const assignRes = await assignVolunteer({
      eventId: fixture.event.id,
      username: regularUser.username,
      adminId: adminUser.id,
    });
    expect(assignRes.ok).toBe(true);

    // Now regular user is volunteer and passes
    mockUser = regularUser;
    mockAdmin = null;

    const resMeVol = await getMeRoute();
    expect(resMeVol.status).toBe(200);

    const resTeamVol = await getTeamRoute(reqTeamAnon);
    expect(resTeamVol.status).toBe(200);

    // Remove volunteer
    if (assignRes.ok) {
      await removeVolunteer({ id: assignRes.id, adminId: adminUser.id });
      const resMeAfterRemove = await getMeRoute();
      expect(resMeAfterRemove.status).toBe(403);
    }
  });
});
