process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTeamCanPlay } from "@/server/algohunt/access";
import { getEventById } from "@/server/algohunt/events";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "@/server/algohunt/testing/next-headers-mock";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAuditLogs } from "@/server/db/schema";
import { PATCH } from "./route";

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

function patchFlags(eventId: string, body: unknown, headers?: Record<string, string>) {
  return PATCH(
    jsonRequest("PATCH", `/api/admin/algohunt/events/${eventId}/flags`, body, headers),
    { params: Promise.resolve({ eventId }) },
  );
}

describe("PATCH events/[eventId]/flags", () => {
  it("turns code redemption off: teams get CODES_DISABLED and the audit row keeps the reason", async () => {
    const fixture = await seedFixture();
    const admin = await signInAdmin();
    const response = await patchFlags(fixture.event.id, {
      codesEnabled: false, reason: "Batch 2 leaked on a group chat", confirm: fixture.event.slug,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, event: { codesEnabled: false } });

    const event = await getEventById(fixture.event.id);
    expect(event?.codesEnabled).toBe(false);
    const ctx = { team: fixture.teams[0].team, event: event! };
    expect(assertTeamCanPlay(ctx, "code")).toMatchObject({ code: "CODES_DISABLED" });
    expect(assertTeamCanPlay(ctx, "submit")).toBeNull();

    const audits = await auditRows("event.flags_changed");
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(admin.id);
    expect(JSON.parse(audits[0].metadata)).toEqual({
      changes: { codesEnabled: false }, reason: "Batch 2 leaked on a group chat",
    });
  });

  it("turns submissions off and back on, changing only the named flag", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const slug = fixture.event.slug;
    await patchFlags(fixture.event.id, { submissionsEnabled: false, reason: "Judge is down", confirm: slug });
    let event = await getEventById(fixture.event.id);
    expect(event).toMatchObject({ submissionsEnabled: false, codesEnabled: true, leaderboardVisible: true });
    expect(assertTeamCanPlay({ team: fixture.teams[0].team, event: event! }, "submit"))
      .toMatchObject({ code: "SUBMISSIONS_DISABLED" });

    await patchFlags(fixture.event.id, { submissionsEnabled: true, reason: "Judge is back", confirm: slug });
    event = await getEventById(fixture.event.id);
    expect(event?.submissionsEnabled).toBe(true);
    expect(await auditRows("event.flags_changed")).toHaveLength(2);
  });

  it("hides and shows the leaderboard", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    await patchFlags(fixture.event.id, {
      leaderboardVisible: false, reason: "Freeze before the final", confirm: fixture.event.slug,
    });
    expect((await getEventById(fixture.event.id))?.leaderboardVisible).toBe(false);
  });

  it("requires a reason of 5 to 500 characters", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const slug = fixture.event.slug;
    for (const reason of [undefined, "", "no", "    ab    ", "x".repeat(501)]) {
      const body = { codesEnabled: false, confirm: slug, ...(reason === undefined ? {} : { reason }) };
      const response = await patchFlags(fixture.event.id, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION" });
    }
    expect((await getEventById(fixture.event.id))?.codesEnabled).toBe(true);
    expect(await auditRows("event.flags_changed")).toHaveLength(0);
  });

  it("rejects a wrong confirmation without changing the flag", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const response = await patchFlags(fixture.event.id, {
      codesEnabled: false, reason: "Testing the guard", confirm: "not-the-slug",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION", error: "Confirmation text does not match." });
    expect((await getEventById(fixture.event.id))?.codesEnabled).toBe(true);
    expect(await auditRows("event.flags_changed")).toHaveLength(0);
  });

  it("rejects a request that changes nothing, and any unknown field", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const slug = fixture.event.slug;
    const nothing = await patchFlags(fixture.event.id, { reason: "Nothing to do", confirm: slug });
    expect(nothing.status).toBe(400);
    expect((await nothing.json()).error).toContain("Choose at least one setting");
    const extra = await patchFlags(fixture.event.id, {
      codesEnabled: false, reason: "Smuggled field", confirm: slug, status: "ENDED",
    });
    expect(extra.status).toBe(400);
    expect((await getEventById(fixture.event.id))).toMatchObject({ status: "LIVE", codesEnabled: true });
  });

  it("does nothing, and writes no audit row, when a switch is already set that way", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const slug = fixture.event.slug;
    const response = await patchFlags(fixture.event.id, { codesEnabled: true, reason: "Double click", confirm: slug });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, changed: false, event: { codesEnabled: true } });
    expect(await auditRows("event.flags_changed")).toHaveLength(0);

    await patchFlags(fixture.event.id, { codesEnabled: false, reason: "Leaked batch", confirm: slug });
    const again = await patchFlags(fixture.event.id, { codesEnabled: false, reason: "Leaked batch", confirm: slug });
    expect(await again.json()).toMatchObject({ changed: false });
    expect(await auditRows("event.flags_changed")).toHaveLength(1);
  });

  it("writes only the flags that really changed", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const response = await patchFlags(fixture.event.id, {
      codesEnabled: true, submissionsEnabled: false, reason: "Judge is down", confirm: fixture.event.slug,
    });
    expect(await response.json()).toMatchObject({ changed: true });
    const audits = await auditRows("event.flags_changed");
    expect(JSON.parse(audits[0].metadata).changes).toEqual({ submissionsEnabled: false });
  });

  it("returns NOT_FOUND for an unknown event", async () => {
    await signInAdmin();
    const response = await patchFlags("no-such-event", { codesEnabled: false, reason: "Whatever", confirm: "x" });
    expect(response.status).toBe(404);
  });

  it("blocks a cross-site request", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const response = await patchFlags(
      fixture.event.id,
      { codesEnabled: false, reason: "Cross-site try", confirm: fixture.event.slug },
      { origin: "https://evil.example" },
    );
    expect(response.status).toBe(403);
    expect((await getEventById(fixture.event.id))?.codesEnabled).toBe(true);
  });
});
