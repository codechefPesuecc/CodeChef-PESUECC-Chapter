process.env.DATABASE_URL = ":memory:";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahClues, ahCodes } from "@/server/db/schema";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { seedFixture } from "@/server/algohunt/testing/fixtures";
import type { SessionUser } from "@/server/auth/session";
import { GET, POST } from "./route";

let mockAdmin: SessionUser | null = null;

vi.mock("@/server/auth/session", () => ({
  getAdminUser: async () => mockAdmin,
  getCurrentUser: async () => mockAdmin,
}));

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

// Made-up riddles only: the real clue book never goes into git.
const TEXT = "Clue\tRiddle\nCL-001\tI have keys but open no doors.\nCL-002\tI run but never walk.";

function post(slug: string, body: unknown, dryRun = false): Request {
  return new Request(`http://localhost/api/admin/algohunt/clues?event=${slug}${dryRun ? "&dryRun=1" : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(setupTestDb);
beforeEach(async () => {
  mockAdmin = null;
  await resetAlgoHuntTables();
});

describe("Admin clue book API", () => {
  it("refuses anyone who isn't an admin and writes nothing", async () => {
    const f = await seedFixture({ codes: 0 });
    expect((await GET(new Request(`http://localhost/api/admin/algohunt/clues?event=${f.event.slug}`))).status).toBe(403);
    expect((await POST(post(f.event.slug, { text: TEXT, confirm: f.event.slug }))).status).toBe(403);
    expect((await POST(post(f.event.slug, { text: TEXT }, true))).status).toBe(403);
    expect(await getDb().select().from(ahClues)).toEqual([]);
  });

  it("dry run reports problems and links without saving", async () => {
    const f = await seedFixture({ codes: 3 });
    await getDb().update(ahCodes).set({ placementNote: "CL-001 · Behind the vending machine" }).where(eq(ahCodes.id, f.codes[0].id));
    await getDb().update(ahCodes).set({ placementNote: "CL-077 · Lift lobby" }).where(eq(ahCodes.id, f.codes[1].id));
    mockAdmin = adminUser;

    const res = await POST(post(f.event.slug, { text: `${TEXT}\nCL-001: Repeated label.` }, true));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      dryRun: true,
      count: 3,
      problems: [{ line: 4, label: "CL-001", message: "Same label as line 2.", duplicateOf: 2 }],
    });
    expect(json.preview.unlinkedClues).toEqual(["CL-002"]);
    expect(json.preview.codesWithoutClue.map((c: { serial: number }) => c.serial)).toEqual([2]);
    expect(json.preview.clues[0].codes.map((c: { serial: number }) => c.serial)).toEqual([1]);
    expect(await getDb().select().from(ahClues)).toEqual([]);
  });

  it("saving needs the typed event slug", async () => {
    const f = await seedFixture({ codes: 0 });
    mockAdmin = adminUser;
    for (const body of [{ text: TEXT }, { text: TEXT, confirm: "wrong-slug" }]) {
      const res = await POST(post(f.event.slug, body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Confirmation mismatch/);
    }
    expect(await getDb().select().from(ahClues)).toEqual([]);

    const res = await POST(post(f.event.slug, { text: TEXT, confirm: f.event.slug }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, dryRun: false, count: 2, publicPath: `/algohunt/clues?event=${f.event.slug}` });
    expect(json.book.clues.map((c: { label: string }) => c.label)).toEqual(["CL-001", "CL-002"]);
    expect(await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.actorId, "admin-1"))).toHaveLength(1);
  });

  it("refuses to save a list with problems, an empty list, or unknown fields", async () => {
    const f = await seedFixture({ codes: 0 });
    mockAdmin = adminUser;
    const bad = await POST(post(f.event.slug, { text: "CL-001\nCL-002: Fine.", confirm: f.event.slug }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).problems).toEqual([{ line: 1, label: "CL-001", message: "Missing the riddle after the label." }]);
    expect((await POST(post(f.event.slug, { text: "\n\n", confirm: f.event.slug }))).status).toBe(400);
    expect((await POST(post(f.event.slug, { text: TEXT, confirm: f.event.slug, eventId: f.event.id }))).status).toBe(400);
    expect((await POST(post("no-such-event", { text: TEXT, confirm: "no-such-event" }))).status).toBe(404);
    expect(await getDb().select().from(ahClues)).toEqual([]);
  });

  it("GET returns the saved book with the codes behind each clue and the public link", async () => {
    const f = await seedFixture({ codes: 2 });
    await getDb().update(ahCodes).set({ placementNote: "cl-002, Under the red bench" }).where(eq(ahCodes.id, f.codes[1].id));
    mockAdmin = adminUser;
    await POST(post(f.event.slug, { text: TEXT, confirm: f.event.slug }));

    const res = await GET(new Request(`http://localhost/api/admin/algohunt/clues?event=${f.event.slug}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json();
    expect(json.publicPath).toBe(`/algohunt/clues?event=${f.event.slug}`);
    expect(json.book.clues).toEqual([
      { label: "CL-001", text: "I have keys but open no doors.", status: "OPEN", foundAt: null, codes: [] },
      {
        label: "CL-002", text: "I run but never walk.", status: "OPEN", foundAt: null,
        codes: [{ serial: 2, status: "ACTIVE", placementNote: "cl-002, Under the red bench", usedAt: null }],
      },
    ]);
    expect(json.book.unlinkedClues).toEqual(["CL-001"]);
  });
});
