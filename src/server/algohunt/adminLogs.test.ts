process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getVolunteersRoute, POST as postVolunteerRoute } from "@/app/api/admin/algohunt/volunteers/route";
import { DELETE as deleteVolunteerRoute } from "@/app/api/admin/algohunt/volunteers/[id]/route";
import { GET as getSubmissionsRoute } from "@/app/api/admin/algohunt/submissions/route";
import { GET as getSubmissionDetailRoute } from "@/app/api/admin/algohunt/submissions/[id]/route";
import { GET as getAuditRoute } from "@/app/api/admin/algohunt/audit/route";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahSubmissions } from "@/server/db/schema";
import { getSubmissionDetail, listAudit, listSubmissions } from "./adminLogs";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture } from "./testing/fixtures";
import type { SessionUser } from "@/server/auth/session";

let mockAdmin: SessionUser | null = null;

vi.mock("@/server/auth/session", () => ({
  getAdminUser: async () => (mockAdmin?.isAdmin ? mockAdmin : null),
  getCurrentUser: async () => mockAdmin,
}));

beforeAll(setupTestDb);
beforeEach(async () => {
  mockAdmin = null;
  await resetAlgoHuntTables();
});

const adminUser: SessionUser = {
  id: "admin-1",
  username: "admin",
  name: "Site Admin",
  email: "admin@codechef.org",
  emailVerified: true,
  phone: null,
  srn: null,
  prn: "PRNADMIN",
  isAdmin: true,
  isTeacher: false,
  createdAt: Date.now(),
};

describe("AlgoHunt Admin Logs & Submissions (Module 3)", () => {
  // Test 18
  it("18. Gate sweep: every admin route you own -> 403 for a non-admin site user and for a team cookie only", async () => {
    mockAdmin = null; // Unauthenticated / team cookie only

    const reqVols = new Request("http://localhost/api/admin/algohunt/volunteers?event=test");
    expect((await getVolunteersRoute(reqVols)).status).toBe(403);

    const reqPostVol = new Request("http://localhost/api/admin/algohunt/volunteers?event=test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });
    expect((await postVolunteerRoute(reqPostVol)).status).toBe(403);

    const reqDelVol = new Request("http://localhost/api/admin/algohunt/volunteers/v1", {
      method: "DELETE",
    });
    expect((await deleteVolunteerRoute(reqDelVol, { params: Promise.resolve({ id: "v1" }) })).status).toBe(403);

    const reqSubs = new Request("http://localhost/api/admin/algohunt/submissions?event=test");
    expect((await getSubmissionsRoute(reqSubs)).status).toBe(403);

    const reqSubDetail = new Request("http://localhost/api/admin/algohunt/submissions/s1");
    expect((await getSubmissionDetailRoute(reqSubDetail, { params: Promise.resolve({ id: "s1" }) })).status).toBe(403);

    const reqAudit = new Request("http://localhost/api/admin/algohunt/audit?event=test");
    expect((await getAuditRoute(reqAudit)).status).toBe(403);

    // Also 403 for non-admin site user
    mockAdmin = { ...adminUser, isAdmin: false };
    expect((await getVolunteersRoute(reqVols)).status).toBe(403);
    expect((await getSubmissionsRoute(reqSubs)).status).toBe(403);
    expect((await getAuditRoute(reqAudit)).status).toBe(403);
  });

  // Test 19
  it("19. listSubmissions rows have no code. getSubmissionDetail has it. Cursor pagination returns disjoint pages.", async () => {
    const fixture = await seedFixture({ stages: 2, teams: 1 });
    const db = getDb();
    const team = fixture.teams[0].team;
    const stage = fixture.stages[0];

    const baseTime = 1700000000000;
    // Seed 5 submissions with different timestamps
    for (let i = 1; i <= 5; i++) {
      await db.insert(ahSubmissions).values({
        id: `sub-${i}`,
        eventId: fixture.event.id,
        teamId: team.id,
        stageId: stage.id,
        challengeId: stage.challengeId,
        language: "cpp",
        code: `// submission code ${i}`,
        status: "FINISHED",
        verdict: i === 1 ? "AC" : "WA",
        passed: i === 1 ? 10 : 3,
        total: 10,
        createdAt: baseTime + i * 1000,
      });
    }

    // 1. listSubmissions rows have NO code property exposed
    const listRes = await listSubmissions({ eventId: fixture.event.id, limit: 10 });
    expect(listRes.rows).toHaveLength(5);
    for (const row of listRes.rows) {
      expect((row as Record<string, unknown>).code).toBeUndefined();
      expect(row.teamCode).toBe(team.teamCode);
      expect(row.stageNumber).toBe(1);
    }

    // 2. getSubmissionDetail has code
    const detail = await getSubmissionDetail("sub-1");
    expect(detail).not.toBeNull();
    expect(detail?.code).toBe("// submission code 1");
    expect(detail?.verdict).toBe("AC");
    expect(detail?.teamCode).toBe(team.teamCode);
    expect(detail?.stageNumber).toBe(1);

    // 3. Cursor pagination returns disjoint pages
    const page1 = await listSubmissions({ eventId: fixture.event.id, limit: 3 });
    expect(page1.rows).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();
    const page1Ids = page1.rows.map((r) => r.id);

    const page2 = await listSubmissions({
      eventId: fixture.event.id,
      cursor: page1.nextCursor ?? undefined,
      limit: 3,
    });
    expect(page2.rows).toHaveLength(2);
    const page2Ids = page2.rows.map((r) => r.id);

    // Disjoint
    const intersection = page1Ids.filter((id) => page2Ids.includes(id));
    expect(intersection).toHaveLength(0);
  });

  // Test 20
  it("20. listAudit filters by team and action prefix, newest first.", async () => {
    const fixture = await seedFixture({ teams: 2 });
    const db = getDb();
    const t1 = fixture.teams[0].team;
    const t2 = fixture.teams[1].team;

    const baseTime = 1700000000000;

    await db.insert(ahAuditLogs).values([
      {
        id: "audit-1",
        eventId: fixture.event.id,
        teamId: t1.id,
        actorType: "ADMIN",
        actorId: "admin-1",
        action: "code.batch_created",
        targetType: "batch",
        metadata: JSON.stringify({ name: "Batch 1" }),
        createdAt: baseTime + 1000,
      },
      {
        id: "audit-2",
        eventId: fixture.event.id,
        teamId: t1.id,
        actorType: "VOLUNTEER",
        actorId: "vol-1",
        action: "team.checked_in",
        targetType: "team",
        metadata: "{}",
        createdAt: baseTime + 2000,
      },
      {
        id: "audit-3",
        eventId: fixture.event.id,
        teamId: t2.id,
        actorType: "ADMIN",
        actorId: "admin-1",
        action: "code.disabled",
        targetType: "code",
        metadata: JSON.stringify({ serial: 1 }),
        createdAt: baseTime + 3000,
      },
    ]);

    // Newest first order
    const all = await listAudit({ eventId: fixture.event.id });
    expect(all.rows).toHaveLength(3);
    expect(all.rows[0].id).toBe("audit-3");
    expect(all.rows[1].id).toBe("audit-2");
    expect(all.rows[2].id).toBe("audit-1");

    // Filter by team
    const t1Logs = await listAudit({ eventId: fixture.event.id, teamCode: t1.teamCode });
    expect(t1Logs.rows).toHaveLength(2);
    expect(t1Logs.rows.map((r) => r.id)).toEqual(["audit-2", "audit-1"]);

    // Filter by actionPrefix
    const codeLogs = await listAudit({ eventId: fixture.event.id, actionPrefix: "code." });
    expect(codeLogs.rows).toHaveLength(2);
    expect(codeLogs.rows.map((r) => r.id)).toEqual(["audit-3", "audit-1"]);
  });
});
