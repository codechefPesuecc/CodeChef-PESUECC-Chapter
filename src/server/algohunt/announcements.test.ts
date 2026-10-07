process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAnnouncements, ahAuditLogs } from "@/server/db/schema";
import { GET, POST } from "@/app/api/admin/algohunt/announcements/route";
import { PATCH } from "@/app/api/admin/algohunt/announcements/[id]/route";
import {
  cleanAnnouncementMessage, createAnnouncement, deactivateAnnouncement, listActiveAnnouncements, listAllAnnouncements,
} from "./announcements";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { createSiteUser, seedFixture, type Fixture } from "./testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "./testing/next-headers-mock";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

const BASE = "https://chapter.example/api/admin/algohunt/announcements";

function post(fixture: Fixture, body: unknown) {
  return POST(new Request(`${BASE}?event=${fixture.event.slug}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

function patch(id: string, body: unknown) {
  return PATCH(new Request(`${BASE}/${id}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
}

async function signInAdmin() {
  const admin = await createSiteUser({ isAdmin: true });
  setSiteSessionCookie(admin.id);
  return admin;
}

describe("announcements", () => {
  it("14. rejects non-admins with 403", async () => {
    const fixture = await seedFixture();
    expect((await post(fixture, { message: "Hello", priority: "INFO" })).status).toBe(403);

    const member = await createSiteUser();
    setSiteSessionCookie(member.id);
    const response = await post(fixture, { message: "Hello", priority: "INFO" });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await patch("anything", { active: false })).status).toBe(403);
    expect((await GET(new Request(`${BASE}?event=${fixture.event.slug}`))).status).toBe(403);
    expect(await getDb().select().from(ahAnnouncements)).toHaveLength(0);
  });

  it("14. validates the message length, priority and unknown fields", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    for (const body of [
      { message: "x".repeat(501), priority: "INFO" },
      { message: "   ", priority: "INFO" },
      { message: "Hello", priority: "URGENT" },
      { message: "Hello", priority: "INFO", eventId: "smuggled" },
    ]) {
      const response = await post(fixture, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    }
    expect((await post(fixture, { message: "x".repeat(500), priority: "INFO" })).status).toBe(200);
    expect((await patch("anything", { active: true })).status).toBe(400);
    expect((await patch("anything", { active: false, extra: 1 })).status).toBe(400);
  });

  it("14. stores plain text without control characters", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const response = await post(fixture, { message: "  QR\u0007 codes\r\nare out\u0000!  ", priority: "WARNING" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.announcement).toMatchObject({ message: "QR codes\nare out!", priority: "WARNING" });
    expect(cleanAnnouncementMessage("<b>hi</b>\t")).toBe("<b>hi</b>");
  });

  it("14. deactivated announcements disappear for teams and audit rows are written", async () => {
    const fixture = await seedFixture();
    const admin = await signInAdmin();
    const created = await (await post(fixture, { message: "The event has started.", priority: "CRITICAL" })).json();
    const id = created.announcement.id as string;
    expect((await listActiveAnnouncements(fixture.event.id)).map((a) => a.id)).toEqual([id]);

    const first = await patch(id, { active: false });
    expect(await first.json()).toMatchObject({ ok: true, changed: true });
    expect(await (await patch(id, { active: false })).json()).toMatchObject({ ok: true, changed: false });
    expect(await listActiveAnnouncements(fixture.event.id)).toEqual([]);
    expect(await listAllAnnouncements(fixture.event.id)).toMatchObject([
      { id, active: false, createdBy: admin.id, priority: "CRITICAL" },
    ]);

    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.targetId, id));
    expect(audits.map((a) => a.action).sort()).toEqual(["announcement.created", "announcement.deactivated"]);
    const createdAudit = audits.find((a) => a.action === "announcement.created")!;
    expect(createdAudit).toMatchObject({ eventId: fixture.event.id, actorType: "ADMIN", actorId: admin.id });
    expect(JSON.parse(createdAudit.metadata)).toEqual({ priority: "CRITICAL", preview: "The event has started." });
    expect(JSON.parse(audits.find((a) => a.action === "announcement.deactivated")!.metadata)).toEqual({});
  });

  it("requires an explicit, non-empty ?event= on the admin routes", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const body = JSON.stringify({ message: "Hello", priority: "INFO" });
    const postTo = (query: string) => POST(new Request(`${BASE}${query}`, {
      method: "POST", headers: { "content-type": "application/json" }, body,
    }));
    for (const query of ["", "?event=", "?event=%20%20"]) {
      for (const response of [await postTo(query), await GET(new Request(`${BASE}${query}`))]) {
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          ok: false, code: "VALIDATION", error: "Add ?event=<slug> to choose the event.",
        });
      }
    }
    expect(await getDb().select().from(ahAnnouncements)).toHaveLength(0);

    for (const response of [await postTo("?event=no-such-event"), await GET(new Request(`${BASE}?event=no-such-event`))]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ ok: false, code: "NOT_FOUND" });
    }

    const created = await postTo(`?event=${fixture.event.slug}`);
    expect(created.status).toBe(200);
    const listed = await (await GET(new Request(`${BASE}?event=${fixture.event.slug}`))).json();
    expect(listed).toMatchObject({ ok: true, announcements: [{ message: "Hello", priority: "INFO", active: true }] });
  });

  it("lists every announcement for admins, newest first", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const a = await createAnnouncement({ eventId: fixture.event.id, message: "First", priority: "INFO", adminId: "admin" });
    await getDb().update(ahAnnouncements).set({ createdAt: 1 }).where(eq(ahAnnouncements.id, a.id));
    const b = await createAnnouncement({ eventId: fixture.event.id, message: "Second", priority: "INFO", adminId: "admin" });
    await deactivateAnnouncement({ id: a.id, adminId: "admin" });
    const body = await (await GET(new Request(`${BASE}?event=${fixture.event.slug}`))).json();
    expect(body.announcements.map((x: { id: string; active: boolean }) => [x.id, x.active])).toEqual([
      [b.id, true], [a.id, false],
    ]);
  });
});
