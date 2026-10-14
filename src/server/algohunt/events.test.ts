process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { EVENT_TRANSITIONS, type EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents } from "@/server/db/schema";
import {
  createEvent,
  getEventById,
  getEventBySlug,
  getTeamCodePrefix,
  listEvents,
  resolveAdminEvent,
  transitionEvent,
  updateEventFlags,
} from "./events";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture } from "./testing/fixtures";

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

describe("event state machine", () => {
  const allowed = Object.entries(EVENT_TRANSITIONS)
    .flatMap(([from, destinations]) => destinations.map((to) => [from as EventStatus, to] as const));

  it.each(allowed)("allows %s → %s", async (from, to) => {
    const fixture = await seedFixture({ eventStatus: from, codes: 0, teams: 0 });
    const result = await transitionEvent({ eventId: fixture.event.id, to, actorId: "admin-1" });
    expect(result).toMatchObject({ ok: true, event: { status: to } });
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "event.transition"));
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].metadata)).toEqual({ from, to });
  });

  it("rejects a disallowed transition", async () => {
    const fixture = await seedFixture({ eventStatus: "DRAFT", codes: 0, teams: 0 });
    expect(await transitionEvent({ eventId: fixture.event.id, to: "ENDED", actorId: "admin-1" }))
      .toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("sets startedAt once and clears pausedAt on resume", async () => {
    const fixture = await seedFixture({ eventStatus: "READY", codes: 0, teams: 0 });
    const started = await transitionEvent({ eventId: fixture.event.id, to: "LIVE", actorId: "admin-1" });
    if (!started.ok) throw new Error(started.message);
    expect(started.event.startedAt).not.toBeNull();
    const paused = await transitionEvent({ eventId: fixture.event.id, to: "PAUSED", actorId: "admin-1" });
    if (!paused.ok) throw new Error(paused.message);
    expect(paused.event.pausedAt).not.toBeNull();
    const resumed = await transitionEvent({ eventId: fixture.event.id, to: "LIVE", actorId: "admin-1" });
    if (!resumed.ok) throw new Error(resumed.message);
    expect(resumed.event.startedAt).toBe(started.event.startedAt);
    expect(resumed.event.pausedAt).toBeNull();
  });

  it("lets one concurrent transition win", async () => {
    const fixture = await seedFixture({ eventStatus: "LIVE", codes: 0, teams: 0 });
    const results = await Promise.all([
      transitionEvent({ eventId: fixture.event.id, to: "PAUSED", actorId: "admin-1" }),
      transitionEvent({ eventId: fixture.event.id, to: "ENDED", actorId: "admin-2" }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
  });

  it("writes one flags audit with the reason", async () => {
    const fixture = await seedFixture({ codes: 0, teams: 0 });
    const event = await updateEventFlags({
      eventId: fixture.event.id, actorId: "admin-1", reason: "Judge maintenance",
      flags: { submissionsEnabled: false },
    });
    expect(event.submissionsEnabled).toBe(false);
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "event.flags_changed"));
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].metadata)).toEqual({
      changes: { submissionsEnabled: false }, reason: "Judge maintenance",
    });
  });
});

describe("event lookup", () => {
  it("finds by id and slug and prefers the newest active non-test event", async () => {
    const test = await seedFixture({ codes: 0, teams: 0 });
    const real = await seedFixture({ codes: 0, teams: 0 });
    await getDb().update(ahEvents).set({ isTest: false, createdAt: test.event.createdAt + 1 })
      .where(eq(ahEvents.id, real.event.id));
    expect((await getEventById(test.event.id))?.id).toBe(test.event.id);
    expect((await getEventBySlug(test.event.slug))?.id).toBe(test.event.id);
    expect((await resolveAdminEvent())?.id).toBe(real.event.id);
    expect((await resolveAdminEvent(test.event.slug))?.id).toBe(test.event.id);
  });
});

describe("event creation and listing (Module 6)", () => {
  it("creates a new event and logs an audit record", async () => {
    const res = await createEvent({
      name: "Spring Hunt 2026",
      slug: "spring-hunt-2026",
      maxTeamSize: 4,
      actorId: "admin-lead",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.event.name).toBe("Spring Hunt 2026");
    expect(res.event.slug).toBe("spring-hunt-2026");
    expect(res.event.status).toBe("DRAFT");
    expect(res.event.maxTeamSize).toBe(4);

    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "event.created"));
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe("admin-lead");
  });

  it("rejects an invalid slug with uppercase or special characters", async () => {
    const res = await createEvent({
      name: "Bad Slug Event",
      slug: "Bad_Slug!",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("VALIDATION");
  });

  it("rejects a duplicate slug", async () => {
    await createEvent({ name: "First", slug: "unique-slug" });
    const duplicate = await createEvent({ name: "Second", slug: "unique-slug" });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.code).toBe("CONFLICT");
  });

  it("lists all events in descending order of creation", async () => {
    await createEvent({ name: "Event A", slug: "event-a" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createEvent({ name: "Event B", slug: "event-b" });
    const all = await listEvents();
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all[0].slug).toBe("event-b");
    expect(all[1].slug).toBe("event-a");
  });

  it("determines team code prefixes correctly", () => {
    expect(getTeamCodePrefix({ slug: "algohunt-2026" })).toBe("AH2");
    expect(getTeamCodePrefix({ slug: "test-event", isTest: true })).toBe("TST");
    expect(getTeamCodePrefix({ slug: "random-slug", isTest: true })).toBe("TST");
    expect(getTeamCodePrefix({ slug: "dry-run-1" })).toBe("DRY");
  });
});
