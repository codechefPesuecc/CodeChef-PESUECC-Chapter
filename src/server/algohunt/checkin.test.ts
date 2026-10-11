process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahTeams } from "@/server/db/schema";
import { checkInAllTeams, checkInTeam } from "./checkin";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture } from "./testing/fixtures";

beforeAll(setupTestDb);
beforeEach(async () => {
  await resetAlgoHuntTables();
});

describe("AlgoHunt Check-in Engine (Module 3)", () => {
  // Test 15
  it("15. REGISTERED -> CHECKED_IN with checkedInAt and an audit row. Repeat -> alreadyCheckedIn: true, no second audit. DQ team -> TEAM_DISQUALIFIED", async () => {
    const fixture = await seedFixture({ teams: 2, teamStatus: "REGISTERED" });
    const db = getDb();
    const targetTeam = fixture.teams[0].team;

    // Initial checkin: REGISTERED -> CHECKED_IN
    const res1 = await checkInTeam({
      eventId: fixture.event.id,
      teamCode: targetTeam.teamCode,
      actorType: "VOLUNTEER",
      actorId: "vol-1",
    });

    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.alreadyCheckedIn).toBe(false);
    expect(res1.team.status).toBe("CHECKED_IN");
    expect(res1.team.checkedInAt).toBeGreaterThan(0);

    // Verify DB update and audit row
    const [teamInDb] = await db.select().from(ahTeams).where(eq(ahTeams.id, targetTeam.id));
    expect(teamInDb.status).toBe("CHECKED_IN");
    expect(teamInDb.checkedInAt).toBe(res1.team.checkedInAt);

    const auditRows = await db
      .select()
      .from(ahAuditLogs)
      .where(and(eq(ahAuditLogs.eventId, fixture.event.id), eq(ahAuditLogs.teamId, targetTeam.id)));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("team.checked_in");
    expect(auditRows[0].actorType).toBe("VOLUNTEER");

    // Repeat checkin -> alreadyCheckedIn: true, no second audit
    const res2 = await checkInTeam({
      eventId: fixture.event.id,
      teamCode: targetTeam.teamCode,
      actorType: "VOLUNTEER",
      actorId: "vol-1",
    });

    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.alreadyCheckedIn).toBe(true);
    expect(res2.team.checkedInAt).toBe(res1.team.checkedInAt);

    const auditRowsAfter = await db
      .select()
      .from(ahAuditLogs)
      .where(and(eq(ahAuditLogs.eventId, fixture.event.id), eq(ahAuditLogs.teamId, targetTeam.id)));
    expect(auditRowsAfter).toHaveLength(1);

    // Disqualified team -> TEAM_DISQUALIFIED
    const dqTeam = fixture.teams[1].team;
    await db
      .update(ahTeams)
      .set({ status: "DISQUALIFIED", disqualifiedAt: Date.now(), disqualificationReason: "Cheating" })
      .where(eq(ahTeams.id, dqTeam.id));

    const resDq = await checkInTeam({
      eventId: fixture.event.id,
      teamCode: dqTeam.teamCode,
      actorType: "VOLUNTEER",
      actorId: "vol-1",
    });

    expect(resDq).toMatchObject({
      ok: false,
      code: "TEAM_DISQUALIFIED",
    });
  });

  // Test 16
  it("16. checkInAllTeams: 3 REGISTERED + 1 DQ + 1 CHECKED_IN -> count 3, DQ untouched, 3 audit rows", async () => {
    const fixture = await seedFixture({ teams: 5, teamStatus: "REGISTERED" });
    const db = getDb();
    const now = Date.now();

    // Setup: team 3 is DQ, team 4 is CHECKED_IN
    const t3 = fixture.teams[3].team;
    const t4 = fixture.teams[4].team;

    await db
      .update(ahTeams)
      .set({ status: "DISQUALIFIED", disqualifiedAt: now })
      .where(eq(ahTeams.id, t3.id));

    await db
      .update(ahTeams)
      .set({ status: "CHECKED_IN", checkedInAt: now - 1000 })
      .where(eq(ahTeams.id, t4.id));

    // Bulk check in
    const bulkRes = await checkInAllTeams({
      eventId: fixture.event.id,
      actorId: "admin-1",
    });

    expect(bulkRes.count).toBe(3);

    // Verify DQ remains untouched
    const [t3After] = await db.select().from(ahTeams).where(eq(ahTeams.id, t3.id));
    expect(t3After.status).toBe("DISQUALIFIED");

    // Verify team 4 remains checked in with original time
    const [t4After] = await db.select().from(ahTeams).where(eq(ahTeams.id, t4.id));
    expect(t4After.status).toBe("CHECKED_IN");
    expect(t4After.checkedInAt).toBe(now - 1000);

    // Verify exactly 3 audit rows created with bulk: true
    const audits = await db
      .select()
      .from(ahAuditLogs)
      .where(and(eq(ahAuditLogs.eventId, fixture.event.id), eq(ahAuditLogs.action, "team.checked_in")));
    expect(audits).toHaveLength(3);
    for (const a of audits) {
      expect(JSON.parse(a.metadata)).toEqual({ bulk: true });
      expect(a.actorType).toBe("ADMIN");
      expect(a.actorId).toBe("admin-1");
    }
  });
});
