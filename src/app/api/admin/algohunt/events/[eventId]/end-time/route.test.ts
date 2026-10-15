process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { COPY } from "@/lib/algohunt/copy";
import { assertTeamCanPlay } from "@/server/algohunt/access";
import { getEventById } from "@/server/algohunt/events";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "@/server/algohunt/testing/next-headers-mock";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents } from "@/server/db/schema";
import { PATCH } from "./route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

async function signInAdmin(): Promise<{ id: string }> {
  const admin = await createSiteUser({ isAdmin: true });
  setSiteSessionCookie(admin.id);
  return admin;
}

function patchEndTime(eventId: string, body: unknown) {
  return PATCH(
    new Request(`https://chapter.example/api/admin/algohunt/events/${eventId}/end-time`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ eventId }) },
  );
}

const endTimeAudits = () => getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "event.end_time_changed"));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

describe("PATCH events/[eventId]/end-time", () => {
  it("schedules the end, and teams are stopped from that moment while the event stays LIVE", async () => {
    const fixture = await seedFixture();
    const admin = await signInAdmin();
    const endsAt = Date.now() + 4 * 3_600_000;
    const response = await patchEndTime(fixture.event.id, {
      endsAt, reason: "Hall booked until 2:30 PM", confirm: fixture.event.slug,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, changed: true, event: { endsAt, status: "LIVE" } });

    const event = (await getEventById(fixture.event.id))!;
    const ctx = { team: fixture.teams[0].team, event };
    expect(assertTeamCanPlay(ctx, "submit", endsAt - 1)).toBeNull();
    expect(assertTeamCanPlay(ctx, "code", endsAt)).toEqual({ code: "EVENT_ENDED", message: COPY.timeUp });

    const [audit] = await endTimeAudits();
    expect(audit).toMatchObject({ actorType: "ADMIN", actorId: admin.id, targetId: fixture.event.id });
    expect(JSON.parse(audit.metadata)).toEqual({ from: null, to: endsAt, reason: "Hall booked until 2:30 PM" });
  });

  it("extends a passed end so play resumes, and can remove it", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const passed = Date.now() - 1_000;
    await getDb().update(ahEvents).set({ endsAt: passed }).where(eq(ahEvents.id, fixture.event.id));
    const extended = passed + 10 * 60_000;
    await patchEndTime(fixture.event.id, { endsAt: extended, reason: "Judge outage, +10 min", confirm: fixture.event.slug });
    const event = (await getEventById(fixture.event.id))!;
    expect(assertTeamCanPlay({ team: fixture.teams[0].team, event }, "submit")).toBeNull();

    const cleared = await patchEndTime(fixture.event.id, { endsAt: null, reason: "End by hand today", confirm: fixture.event.slug });
    expect(await cleared.json()).toMatchObject({ changed: true, event: { endsAt: null } });
    expect(await endTimeAudits()).toHaveLength(2);
  });

  it("writes nothing when the end time is unchanged", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const body = { endsAt: Date.now() + 3_600_000, reason: "Double click", confirm: fixture.event.slug };
    await patchEndTime(fixture.event.id, body);
    expect(await (await patchEndTime(fixture.event.id, body)).json()).toMatchObject({ ok: true, changed: false });
    expect(await endTimeAudits()).toHaveLength(1);
  });

  it("refuses an ended event, a wrong confirmation and bad input, changing nothing", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const endsAt = Date.now() + 3_600_000;
    expect((await patchEndTime(fixture.event.id, { endsAt, reason: "Wrong slug", confirm: "nope" })).status).toBe(400);
    expect((await patchEndTime(fixture.event.id, { endsAt, reason: "x", confirm: fixture.event.slug })).status).toBe(400);
    expect((await patchEndTime(fixture.event.id, { endsAt: "2:30", reason: "Bad type", confirm: fixture.event.slug })).status).toBe(400);
    expect((await patchEndTime(fixture.event.id, { endsAt, reason: "Extra field", confirm: fixture.event.slug, status: "ENDED" })).status).toBe(400);
    expect((await patchEndTime("missing-event", { endsAt, reason: "Unknown event", confirm: "x" })).status).toBe(404);

    await getDb().update(ahEvents).set({ status: "ENDED" }).where(eq(ahEvents.id, fixture.event.id));
    expect((await patchEndTime(fixture.event.id, { endsAt, reason: "Too late now", confirm: fixture.event.slug })).status).toBe(409);
    expect((await getEventById(fixture.event.id))?.endsAt).toBeNull();
    expect(await endTimeAudits()).toHaveLength(0);
  });
});
