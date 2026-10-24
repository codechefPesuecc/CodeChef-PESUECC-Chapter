process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "@/server/algohunt/testing/next-headers-mock";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahStages } from "@/server/db/schema";
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

function patchStage(stageId: string, body: unknown, headers?: Record<string, string>) {
  return PATCH(
    jsonRequest("PATCH", `/api/admin/algohunt/stages/${stageId}`, body, headers),
    { params: Promise.resolve({ stageId }) },
  );
}

async function storedEnabled(stageId: string): Promise<boolean | undefined> {
  const [row] = await getDb().select({ enabled: ahStages.enabled }).from(ahStages).where(eq(ahStages.id, stageId));
  return row?.enabled;
}

describe("PATCH stages/[stageId]", () => {
  it("disables a question and writes one stage.toggled audit row with the reason", async () => {
    const fixture = await seedFixture();
    const admin = await signInAdmin();
    const stage = fixture.stages[1];
    const response = await patchStage(stage.id, {
      enabled: false, reason: "Statement has a typo", confirm: fixture.event.slug,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true, changed: true, stage: { id: stage.id, stageNumber: 2, enabled: false },
    });
    expect(await storedEnabled(stage.id)).toBe(false);
    expect(await storedEnabled(fixture.stages[0].id)).toBe(true);

    const audits = await auditRows("stage.toggled");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorType: "ADMIN", actorId: admin.id, eventId: fixture.event.id, targetType: "stage", targetId: stage.id,
    });
    expect(JSON.parse(audits[0].metadata)).toEqual({
      stageNumber: 2, enabled: false, reason: "Statement has a typo",
    });
  });

  it("re-enables a question; repeating the same request changes nothing and adds no audit row", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const stage = fixture.stages[0];
    const slug = fixture.event.slug;
    await patchStage(stage.id, { enabled: false, reason: "Broken tests", confirm: slug });
    const again = await patchStage(stage.id, { enabled: false, reason: "Broken tests", confirm: slug });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ changed: false });
    expect(await auditRows("stage.toggled")).toHaveLength(1);

    const back = await patchStage(stage.id, { enabled: true, reason: "Tests fixed", confirm: slug });
    expect(await back.json()).toMatchObject({ changed: true, stage: { enabled: true } });
    expect(await storedEnabled(stage.id)).toBe(true);
    expect(await auditRows("stage.toggled")).toHaveLength(2);
  });

  it("rejects a wrong confirmation, including another event's slug", async () => {
    const fixture = await seedFixture();
    const other = await seedFixture();
    await signInAdmin();
    const stage = fixture.stages[0];
    for (const confirm of ["", "nope", other.event.slug]) {
      const response = await patchStage(stage.id, { enabled: false, reason: "Guard check", confirm });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION", error: "Confirmation text does not match." });
    }
    expect(await storedEnabled(stage.id)).toBe(true);
    expect(await auditRows("stage.toggled")).toHaveLength(0);
  });

  it("requires a valid reason and rejects unknown fields", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const stage = fixture.stages[0];
    const slug = fixture.event.slug;
    for (const body of [
      { enabled: false, confirm: slug },
      { enabled: false, reason: "no", confirm: slug },
      { enabled: false, reason: "Valid reason", confirm: slug, challengeId: "x" },
      { enabled: "false", reason: "Valid reason", confirm: slug },
    ]) {
      const response = await patchStage(stage.id, body);
      expect(response.status).toBe(400);
    }
    expect(await storedEnabled(stage.id)).toBe(true);
    expect(await auditRows("stage.toggled")).toHaveLength(0);
  });

  it("returns NOT_FOUND for an unknown question", async () => {
    await signInAdmin();
    const response = await patchStage("no-such-stage", { enabled: false, reason: "Whatever", confirm: "x" });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("blocks a cross-site request", async () => {
    const fixture = await seedFixture();
    await signInAdmin();
    const response = await patchStage(
      fixture.stages[0].id,
      { enabled: false, reason: "Cross-site try", confirm: fixture.event.slug },
      { origin: "https://evil.example" },
    );
    expect(response.status).toBe(403);
    expect(await storedEnabled(fixture.stages[0].id)).toBe(true);
  });
});
