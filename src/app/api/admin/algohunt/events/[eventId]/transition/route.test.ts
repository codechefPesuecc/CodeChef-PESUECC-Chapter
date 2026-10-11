process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getEventById } from "@/server/algohunt/events";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "@/server/algohunt/testing/next-headers-mock";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAuditLogs } from "@/server/db/schema";
import { POST } from "./route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

async function signInAdmin(): Promise<{ id: string; username: string }> {
  const admin = await createSiteUser({ isAdmin: true });
  setSiteSessionCookie(admin.id);
  return admin;
}

function jsonRequest(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://chapter.example${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const auditRows = (action: string) => getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, action));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function transition(eventId: string, body: unknown, headers?: Record<string, string>) {
  return POST(
    jsonRequest("POST", `/api/admin/algohunt/events/${eventId}/transition`, body, headers),
    { params: Promise.resolve({ eventId }) },
  );
}

describe("POST events/[eventId]/transition", () => {
  it("starts the event: READY to LIVE with the slug sets startedAt and writes one audit row", async () => {
    const fixture = await seedFixture({ eventStatus: "READY" });
    const admin = await signInAdmin();
    const response = await transition(fixture.event.id, { to: "LIVE", confirm: fixture.event.slug });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, event: { status: "LIVE" } });
    expect(typeof body.event.startedAt).toBe("number");
    const stored = await getEventById(fixture.event.id);
    expect(stored?.status).toBe("LIVE");
    expect(stored?.startedAt).toBe(body.event.startedAt);
    const audits = await auditRows("event.transition");
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(admin.id);
    expect(JSON.parse(audits[0].metadata)).toEqual({ from: "READY", to: "LIVE" });
  });

  it("rejects a move the state machine does not allow with CONFLICT and changes nothing", async () => {
    const fixture = await seedFixture({ eventStatus: "DRAFT" });
    await signInAdmin();
    const response = await transition(fixture.event.id, { to: "LIVE", confirm: fixture.event.slug });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await getEventById(fixture.event.id))?.status).toBe("DRAFT");
    expect(await auditRows("event.transition")).toHaveLength(0);
  });

  it("rejects a wrong confirmation with VALIDATION and changes nothing", async () => {
    const fixture = await seedFixture({ eventStatus: "READY" });
    await signInAdmin();
    for (const confirm of ["", "wrong", fixture.event.slug.toUpperCase(), `${fixture.event.slug} `]) {
      const response = await transition(fixture.event.id, { to: "LIVE", confirm });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        ok: false, code: "VALIDATION", error: "Confirmation text does not match.",
      });
    }
    expect((await getEventById(fixture.event.id))?.status).toBe("READY");
    expect(await auditRows("event.transition")).toHaveLength(0);
  });

  it("rejects unknown fields, an unknown status, and a missing confirm", async () => {
    const fixture = await seedFixture({ eventStatus: "READY" });
    await signInAdmin();
    const slug = fixture.event.slug;
    for (const body of [
      { to: "LIVE", confirm: slug, extra: true },
      { to: "RUNNING", confirm: slug },
      { to: "LIVE" },
      {},
    ]) {
      const response = await transition(fixture.event.id, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION" });
    }
    expect((await getEventById(fixture.event.id))?.status).toBe("READY");
  });

  it("returns NOT_FOUND for an unknown event", async () => {
    await signInAdmin();
    const response = await transition("no-such-event", { to: "LIVE", confirm: "x" });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("pauses and resumes: pausedAt is set, then cleared, and startedAt is kept", async () => {
    const fixture = await seedFixture({ eventStatus: "LIVE" });
    await signInAdmin();
    const slug = fixture.event.slug;
    const paused = await (await transition(fixture.event.id, { to: "PAUSED", confirm: slug })).json();
    expect(paused.event.status).toBe("PAUSED");
    expect(typeof paused.event.pausedAt).toBe("number");
    const resumed = await (await transition(fixture.event.id, { to: "LIVE", confirm: slug })).json();
    expect(resumed.event.status).toBe("LIVE");
    expect(resumed.event.pausedAt).toBeNull();
    expect(resumed.event.startedAt).toBe(fixture.event.startedAt);
    expect(await auditRows("event.transition")).toHaveLength(2);
  });

  it("blocks a cross-site request", async () => {
    const fixture = await seedFixture({ eventStatus: "READY" });
    await signInAdmin();
    const response = await transition(
      fixture.event.id, { to: "LIVE", confirm: fixture.event.slug }, { origin: "https://evil.example" },
    );
    expect(response.status).toBe(403);
    expect((await getEventById(fixture.event.id))?.status).toBe("READY");
  });
});
