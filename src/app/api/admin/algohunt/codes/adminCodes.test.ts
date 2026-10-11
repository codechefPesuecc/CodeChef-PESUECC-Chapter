process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getCodesRoute } from "./route";
import { POST as postBatchRoute } from "./batches/route";
import { GET as getPrintRoute } from "./batches/[batchId]/print/route";
import { POST as postDisableBatchRoute } from "./batches/[batchId]/disable/route";
import { PATCH as patchCodeRoute } from "./[codeId]/route";
import { GET as getAttemptsRoute } from "../code-attempts/route";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { seedFixture } from "@/server/algohunt/testing/fixtures";
import type { SessionUser } from "@/server/auth/session";

let mockAdmin: SessionUser | null = null;

vi.mock("@/server/auth/session", () => ({
  getAdminUser: async () => mockAdmin,
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

describe("AlgoHunt Admin Code Management APIs (Module 3 PR 2)", () => {
  it("Gate sweep: unauthenticated / non-admin requests receive 403 FORBIDDEN", async () => {
    mockAdmin = null;

    const reqGetCodes = new Request("http://localhost/api/admin/algohunt/codes?event=test");
    const resGetCodes = await getCodesRoute(reqGetCodes);
    expect(resGetCodes.status).toBe(403);

    const reqPostBatch = new Request("http://localhost/api/admin/algohunt/codes/batches?event=test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "B1", size: 10, confirm: "test" }),
    });
    const resPostBatch = await postBatchRoute(reqPostBatch);
    expect(resPostBatch.status).toBe(403);

    const reqGetPrint = new Request("http://localhost/api/admin/algohunt/codes/batches/b1/print");
    const resGetPrint = await getPrintRoute(reqGetPrint, { params: Promise.resolve({ batchId: "b1" }) });
    expect(resGetPrint.status).toBe(403);

    const reqPostDisable = new Request("http://localhost/api/admin/algohunt/codes/batches/b1/disable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Lost voucher", confirm: "test" }),
    });
    const resPostDisable = await postDisableBatchRoute(reqPostDisable, { params: Promise.resolve({ batchId: "b1" }) });
    expect(resPostDisable.status).toBe(403);

    const reqPatchCode = new Request("http://localhost/api/admin/algohunt/codes/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "NOTE", placementNote: "Corner" }),
    });
    const resPatchCode = await patchCodeRoute(reqPatchCode, { params: Promise.resolve({ codeId: "c1" }) });
    expect(resPatchCode.status).toBe(403);

    const reqGetAttempts = new Request("http://localhost/api/admin/algohunt/code-attempts?event=test");
    const resGetAttempts = await getAttemptsRoute(reqGetAttempts);
    expect(resGetAttempts.status).toBe(403);
  });

  it("POST /api/admin/algohunt/codes/batches creates batch when confirmation slug matches", async () => {
    const fixture = await seedFixture({ codes: 0 });
    mockAdmin = adminUser;

    // Wrong confirmation slug
    const badReq = new Request(`http://localhost/api/admin/algohunt/codes/batches?event=${fixture.event.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Live 1", size: 20, confirm: "wrong-slug" }),
    });
    const badRes = await postBatchRoute(badReq);
    expect(badRes.status).toBe(400);

    // Valid request
    const goodReq = new Request(`http://localhost/api/admin/algohunt/codes/batches?event=${fixture.event.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Live 1", size: 20, confirm: fixture.event.slug }),
    });
    const goodRes = await postBatchRoute(goodReq);
    expect(goodRes.status).toBe(200);
    const json = await goodRes.json() as { ok: boolean; batch: { name: string; size: number }; codes: { serial: number; code: string }[] };
    expect(json.ok).toBe(true);
    expect(json.batch.name).toBe("Live 1");
    expect(json.batch.size).toBe(20);
    expect(json.codes).toHaveLength(20);
  });

  it("GET /api/admin/algohunt/codes returns stats, batches, and codes", async () => {
    const fixture = await seedFixture({ codes: 5 });
    mockAdmin = adminUser;

    const req = new Request(`http://localhost/api/admin/algohunt/codes?event=${fixture.event.slug}`);
    const res = await getCodesRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      ok: boolean;
      stats: { total: number; active: number };
      batches: { name: string }[];
      codes: { id: string; code: string; serial: number }[];
    };
    expect(json.ok).toBe(true);
    expect(json.stats.total).toBe(5);
    expect(json.stats.active).toBe(5);
    expect(json.batches).toHaveLength(1);
    expect(json.codes).toHaveLength(5);
  });

  it("GET /api/admin/algohunt/codes/batches/[batchId]/print returns batch and codes with Cache-Control: no-store", async () => {
    const fixture = await seedFixture({ codes: 5 });
    mockAdmin = adminUser;

    const req = new Request(`http://localhost/api/admin/algohunt/codes/batches/${fixture.batch.id}/print`);
    const res = await getPrintRoute(req, { params: Promise.resolve({ batchId: fixture.batch.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json() as { ok: boolean; batch: { id: string }; codes: { serial: number; code: string }[] };
    expect(json.ok).toBe(true);
    expect(json.batch.id).toBe(fixture.batch.id);
    expect(json.codes).toHaveLength(5);
  });

  it("PATCH /api/admin/algohunt/codes/[codeId] updates placement note and toggles availability", async () => {
    const fixture = await seedFixture({ codes: 2 });
    mockAdmin = adminUser;
    const targetCode = fixture.codes[0];

    // Update note
    const noteReq = new Request(`http://localhost/api/admin/algohunt/codes/${targetCode.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "NOTE", placementNote: "Hidden near Room 101" }),
    });
    const noteRes = await patchCodeRoute(noteReq, { params: Promise.resolve({ codeId: targetCode.id }) });
    expect(noteRes.status).toBe(200);

    // Disable code
    const disReq = new Request(`http://localhost/api/admin/algohunt/codes/${targetCode.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "DISABLE", reason: "Found damaged on floor" }),
    });
    const disRes = await patchCodeRoute(disReq, { params: Promise.resolve({ codeId: targetCode.id }) });
    expect(disRes.status).toBe(200);

    // Enable code
    const enReq = new Request(`http://localhost/api/admin/algohunt/codes/${targetCode.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "ENABLE", reason: "Voucher re-printed and verified" }),
    });
    const enRes = await patchCodeRoute(enReq, { params: Promise.resolve({ codeId: targetCode.id }) });
    expect(enRes.status).toBe(200);
  });

  it("POST /api/admin/algohunt/codes/batches/[batchId]/disable disables active codes in batch", async () => {
    const fixture = await seedFixture({ codes: 4 });
    mockAdmin = adminUser;

    const disReq = new Request(
      `http://localhost/api/admin/algohunt/codes/batches/${fixture.batch.id}/disable`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "Batch leaked before event",
          confirm: fixture.event.slug,
        }),
      }
    );
    const disRes = await postDisableBatchRoute(disReq, { params: Promise.resolve({ batchId: fixture.batch.id }) });
    expect(disRes.status).toBe(200);
    const json = await disRes.json() as { ok: boolean; disabled: number };
    expect(json.ok).toBe(true);
    expect(json.disabled).toBe(4);
  });

  it("GET /api/admin/algohunt/code-attempts returns logged redemption attempts", async () => {
    const fixture = await seedFixture({ codes: 2 });
    mockAdmin = adminUser;

    const req = new Request(`http://localhost/api/admin/algohunt/code-attempts?event=${fixture.event.slug}`);
    const res = await getAttemptsRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; attempts: unknown[] };
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.attempts)).toBe(true);
  });
});
