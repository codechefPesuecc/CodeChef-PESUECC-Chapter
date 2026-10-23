process.env.DATABASE_URL = ":memory:";

import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as publicCluesRoute } from "@/app/api/algohunt/clues/route";
import {
  deriveClueStatus,
  isClueLikeToken,
  JUST_FOUND_MS,
  MAX_CLUE_TEXT,
  splitClueBook,
  type PublicClue,
  type PublicClueBook,
} from "@/lib/algohunt/clues";
import type { EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahClues, ahCodes, ahEvents, rateLimits } from "@/server/db/schema";
import {
  getAdminClueBook,
  getPublicClueBook,
  parseClueLines,
  placementToken,
  previewClueBook,
  replaceClues,
  resolveClueBookEvent,
  validateClues,
} from "./clues";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture, type Fixture } from "./testing/fixtures";

// Made-up riddles only: the real clue book never goes into git.
const CLUES_TEXT = [
  "Clue ID\tRiddle",
  "CL-001\tI have keys but open no doors.",
  "CL-002\tI run but never walk.",
  "CL-003\tThe more you take, the more you leave behind.",
  "CL-004\tI have a face and two hands but no arms.",
].join("\n");

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);
afterEach(() => {
  vi.restoreAllMocks();
});

async function setNote(codeId: string, placementNote: string | null): Promise<void> {
  await getDb().update(ahCodes).set({ placementNote }).where(eq(ahCodes.id, codeId));
}

async function setEvent(eventId: string, patch: Partial<typeof ahEvents.$inferInsert>): Promise<void> {
  await getDb().update(ahEvents).set(patch).where(eq(ahEvents.id, eventId));
}

/**
 * CL-001 → code 1 USED (and code 2, ACTIVE, also placed there); CL-002 → code 3 DISABLED;
 * CL-003 → no code; CL-004 → code 4 ACTIVE ("cl-004," lower case, comma). Code 5 has a clue-like note
 * with no clue (CL-099), code 6 a plain note.
 */
async function seedLinkedClues(f: Fixture, usedAt = Date.now() - 60_000): Promise<void> {
  const [c1, c2, c3, c4, c5, c6] = f.codes;
  await setNote(c1.id, "CL-001 · Behind the vending machine");
  await setNote(c2.id, "CL-001 · Spare sticker on the notice board");
  await setNote(c3.id, "CL-002 · Under the red bench");
  await setNote(c4.id, "cl-004, next to the water cooler");
  await setNote(c5.id, "CL-099 · Lift lobby");
  await setNote(c6.id, "Ground floor, by the stairs");
  await getDb().update(ahCodes)
    .set({ status: "USED", usedAt, usedByTeamId: f.teams[0].team.id, usedAfterStageId: f.stages[0].id })
    .where(eq(ahCodes.id, c1.id));
  await getDb().update(ahCodes)
    .set({ status: "DISABLED", disabledAt: Date.now(), disabledBy: "admin-1", disabledReason: "Sticker torn off" })
    .where(eq(ahCodes.id, c3.id));
  const saved = await replaceClues({ eventId: f.event.id, entries: parseClueLines(CLUES_TEXT), adminId: "admin-1" });
  expect(saved).toEqual({ ok: true, count: 4 });
}

function publicRequest(query = ""): Request {
  return new Request(`https://chapter.example/api/algohunt/clues${query}`, {
    headers: { "x-forwarded-for": "203.0.113.7" },
  });
}

async function fetchPublic(query = ""): Promise<{ status: number; text: string; json: PublicClueBook & { ok: boolean; code?: string } }> {
  const res = await publicCluesRoute(publicRequest(query));
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) };
}

function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => allKeys(item, keys));
  else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      allKeys(nested, keys);
    }
  }
  return keys;
}

describe("parseClueLines", () => {
  it("splits each line at its first tab, colon, comma or ' · ', keeping 1-based line numbers", () => {
    const lines = parseClueLines([
      "",
      "CL-001\tI have keys: but open no doors, ever.",
      "CL-002: I run, but never walk.",
      "   ",
      "CL-003, Feed me and I live: give me a drink and I die.",
      "CL-004 · I have a face · and two hands.",
      "CL-005\tSpread over\t\tthree cells\t",
    ].join("\r\n"));
    expect(lines).toEqual([
      { line: 2, label: "CL-001", text: "I have keys: but open no doors, ever." },
      { line: 3, label: "CL-002", text: "I run, but never walk." },
      { line: 5, label: "CL-003", text: "Feed me and I live: give me a drink and I die." },
      { line: 6, label: "CL-004", text: "I have a face · and two hands." },
      { line: 7, label: "CL-005", text: "Spread over three cells" },
    ]);
  });

  it("skips a header row only when it is the first line", () => {
    for (const header of ["Clue\tRiddle", "Clue ID, Riddle", "label: text", "CLUE ID\tText"]) {
      expect(parseClueLines(`${header}\nCL-001: I run but never walk.`)).toEqual([
        { line: 2, label: "CL-001", text: "I run but never walk." },
      ]);
    }
    expect(parseClueLines("CL-001: I run.\nLabel: Not a header here.").map((l) => l.label)).toEqual(["CL-001", "Label"]);
  });

  it("keeps a line without a separator as a label with no riddle", () => {
    expect(parseClueLines("CL-001\nWhere the books sleep")).toEqual([
      { line: 1, label: "CL-001", text: "" },
      { line: 2, label: "Where the books sleep", text: "" },
    ]);
  });
});

describe("validateClues", () => {
  it("accepts a clean list", () => {
    expect(validateClues(parseClueLines(CLUES_TEXT))).toEqual([]);
  });

  it("reports missing, spaced, over-long and repeated labels and riddles by line", () => {
    const long = "x".repeat(MAX_CLUE_TEXT + 1);
    const problems = validateClues(parseClueLines([
      "CL-001: I run but never walk.",
      ": No label here.",
      "CL-002",
      "Where the books sleep",
      "CL 003: A label with a space.",
      `${"L".repeat(21)}: Label too long.`,
      `CL-004: ${long}`,
      "cl-001: Same label, other case.",
      `${"M".repeat(20)}: Twenty characters is fine.`,
    ].join("\n")));
    expect(problems).toEqual([
      { line: 2, label: "", message: "Missing the clue label." },
      { line: 3, label: "CL-002", message: "Missing the riddle after the label." },
      { line: 4, label: "Where the books sleep", message: "Put a tab, a colon, a comma or ' · ' between the label and the riddle." },
      { line: 5, label: "CL 003", message: "The label can't contain spaces." },
      { line: 6, label: "L".repeat(21), message: "The label is over 20 characters." },
      { line: 7, label: "CL-004", message: `The riddle is over ${MAX_CLUE_TEXT} characters.` },
      { line: 8, label: "cl-001", message: "Same label as line 1.", duplicateOf: 1 },
    ]);
  });
});

describe("linking rules", () => {
  it("reads the leading token of a placement note", () => {
    expect(placementToken("CL-012 · Outside the library")).toBe("CL-012");
    expect(placementToken("  cl-012, near the gate")).toBe("cl-012");
    expect(placementToken("CL-012\tTab separated")).toBe("CL-012");
    expect(placementToken("CL-012")).toBe("CL-012");
    expect(placementToken("")).toBeNull();
    expect(placementToken(null)).toBeNull();
    expect(isClueLikeToken("CL-012")).toBe(true);
    expect(isClueLikeToken("12")).toBe(true);
    expect(isClueLikeToken("Ground")).toBe(false);
    expect(isClueLikeToken("2nd")).toBe(false);
  });

  it("derives FOUND from any used code (first use), UNAVAILABLE when all are disabled, else OPEN", () => {
    expect(deriveClueStatus([])).toEqual({ status: "OPEN", foundAt: null });
    expect(deriveClueStatus([{ status: "ACTIVE", usedAt: null }])).toEqual({ status: "OPEN", foundAt: null });
    expect(deriveClueStatus([{ status: "DISABLED", usedAt: null }, { status: "DISABLED", usedAt: null }]))
      .toEqual({ status: "UNAVAILABLE", foundAt: null });
    expect(deriveClueStatus([{ status: "DISABLED", usedAt: null }, { status: "ACTIVE", usedAt: null }]))
      .toEqual({ status: "OPEN", foundAt: null });
    expect(deriveClueStatus([{ status: "USED", usedAt: 500 }, { status: "USED", usedAt: 200 }, { status: "DISABLED", usedAt: null }]))
      .toEqual({ status: "FOUND", foundAt: 200 });
  });

  it("splits the public page into open clues, just found (newest first) and the rest, in label order", () => {
    const now = 10_000_000;
    const clue = (label: string, status: PublicClue["status"], foundAt: number | null = null): PublicClue =>
      ({ label, text: `Riddle ${label}`, status, foundAt });
    const { open, justFound, done } = splitClueBook([
      clue("CL-10", "OPEN"),
      clue("CL-9", "FOUND", now - JUST_FOUND_MS), // exactly 3 minutes ago: no longer "just"
      clue("CL-2", "OPEN"),
      clue("CL-3", "FOUND", now - 60_000),
      clue("CL-4", "FOUND", now - 5_000),
      clue("CL-1", "UNAVAILABLE"),
    ], now);
    expect(open.map((c) => c.label)).toEqual(["CL-2", "CL-10"]);
    expect(justFound.map((c) => c.label)).toEqual(["CL-4", "CL-3"]);
    expect(done.map((c) => c.label)).toEqual(["CL-1", "CL-9"]);
  });

  it("links codes to clues case-insensitively and reports unlinked clues and codes without a clue", async () => {
    const f = await seedFixture({ codes: 6 });
    const usedAt = Date.now() - 90_000;
    await seedLinkedClues(f, usedAt);

    const book = await getPublicClueBook(f.event.id);
    expect(book?.clues).toEqual([
      { label: "CL-001", text: "I have keys but open no doors.", status: "FOUND", foundAt: usedAt },
      { label: "CL-002", text: "I run but never walk.", status: "UNAVAILABLE", foundAt: null },
      { label: "CL-003", text: "The more you take, the more you leave behind.", status: "OPEN", foundAt: null },
      { label: "CL-004", text: "I have a face and two hands but no arms.", status: "OPEN", foundAt: null },
    ]);
    expect(book).toMatchObject({ visible: true, final: false, openCount: 2, total: 4 });

    const admin = await getAdminClueBook(f.event.id);
    expect(admin.clues.map((c) => [c.label, c.status, c.codes.map((code) => code.serial)])).toEqual([
      ["CL-001", "FOUND", [1, 2]],
      ["CL-002", "UNAVAILABLE", [3]],
      ["CL-003", "OPEN", []],
      ["CL-004", "OPEN", [4]],
    ]);
    expect(admin.unlinkedClues).toEqual(["CL-003"]);
    expect(admin.codesWithoutClue).toEqual([
      { serial: 5, status: "ACTIVE", placementNote: "CL-099 · Lift lobby", usedAt: null },
    ]);
    expect(admin.savedAt).toEqual(expect.any(Number));
  });

  it("previews a pasted list against the codes without saving it", async () => {
    const f = await seedFixture({ codes: 6 });
    await setNote(f.codes[4].id, "CL-099 · Lift lobby");
    const preview = await previewClueBook(f.event.id, parseClueLines("CL-099: I am always in front of you."));
    expect(preview.clues.map((c) => [c.label, c.codes.map((code) => code.serial)])).toEqual([["CL-099", [5]]]);
    expect(preview.codesWithoutClue).toEqual([]);
    expect(await getDb().select().from(ahClues)).toEqual([]);
  });

  it("sorts the public clue book in label order (CL-2 before CL-10)", async () => {
    const f = await seedFixture({ codes: 0 });
    await replaceClues({
      eventId: f.event.id,
      entries: parseClueLines("CL-10: Ten.\nCL-2: Two.\ncl-1: One."),
      adminId: "admin-1",
    });
    expect((await getPublicClueBook(f.event.id))?.clues.map((c) => c.label)).toEqual(["cl-1", "CL-2", "CL-10"]);
    expect((await getAdminClueBook(f.event.id)).clues.map((c) => c.label)).toEqual(["CL-10", "CL-2", "cl-1"]);
  });
});

describe("replaceClues", () => {
  it("replaces the whole clue book in one batch with one audit row and no clue text in the log", async () => {
    const f = await seedFixture({ codes: 0 });
    const db = getDb();
    const batchSpy = vi.spyOn(db, "batch");

    const first = await replaceClues({ eventId: f.event.id, entries: parseClueLines(CLUES_TEXT), adminId: "admin-1" });
    expect(first).toEqual({ ok: true, count: 4 });
    expect(batchSpy).toHaveBeenCalledTimes(1);

    // 50 clues need several insert statements (7 bound values per row, at most 100 per statement).
    const many = Array.from({ length: 50 }, (_, i) => `R-${i + 1}: Riddle number ${i + 1}.`).join("\n");
    const second = await replaceClues({ eventId: f.event.id, entries: parseClueLines(many), adminId: "admin-1" });
    expect(second).toEqual({ ok: true, count: 50 });
    expect(batchSpy).toHaveBeenCalledTimes(2);

    const rows = await db.select().from(ahClues).where(eq(ahClues.eventId, f.event.id));
    expect(rows).toHaveLength(50);
    expect(rows.some((r) => r.label === "CL-001")).toBe(false);
    expect(rows.map((r) => r.position).sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

    const audit = await db.select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "clues.replaced"));
    expect(audit).toHaveLength(2);
    expect(audit.map((a) => JSON.parse(a.metadata))).toEqual(expect.arrayContaining([
      { count: 4, previousCount: 0 },
      { count: 50, previousCount: 4 },
    ]));
    expect(JSON.stringify(audit)).not.toContain("Riddle number");
  });

  it("leaves other events' clue books alone", async () => {
    const a = await seedFixture({ codes: 0 });
    const b = await seedFixture({ codes: 0 });
    await replaceClues({ eventId: a.event.id, entries: parseClueLines("A-1: Alpha."), adminId: "admin-1" });
    await replaceClues({ eventId: b.event.id, entries: parseClueLines("B-1: Beta."), adminId: "admin-1" });
    await replaceClues({ eventId: a.event.id, entries: parseClueLines("A-2: Alpha two."), adminId: "admin-1" });
    expect((await getPublicClueBook(b.event.id))?.clues.map((c) => c.label)).toEqual(["B-1"]);
    expect((await getPublicClueBook(a.event.id))?.clues.map((c) => c.label)).toEqual(["A-2"]);
  });

  it("writes nothing when a line has a problem, the list is empty or too long, or the event is over", async () => {
    const f = await seedFixture({ codes: 0 });
    const bad = await replaceClues({ eventId: f.event.id, entries: parseClueLines("CL-1: Fine.\nCL-1: Repeated."), adminId: "admin-1" });
    expect(bad).toMatchObject({ ok: false, code: "VALIDATION", problems: [{ line: 2, duplicateOf: 1 }] });
    expect(await replaceClues({ eventId: f.event.id, entries: [], adminId: "admin-1" })).toMatchObject({ ok: false, code: "VALIDATION" });
    const tooMany = Array.from({ length: 201 }, (_, i) => `R-${i}: Riddle.`).join("\n");
    expect(await replaceClues({ eventId: f.event.id, entries: parseClueLines(tooMany), adminId: "admin-1" }))
      .toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await replaceClues({ eventId: "no-such-event", entries: parseClueLines("CL-1: Fine."), adminId: "admin-1" }))
      .toMatchObject({ ok: false, code: "NOT_FOUND" });
    await setEvent(f.event.id, { status: "ENDED", endedAt: Date.now() });
    expect(await replaceClues({ eventId: f.event.id, entries: parseClueLines("CL-1: Fine."), adminId: "admin-1" }))
      .toMatchObject({ ok: false, code: "EVENT_ENDED" });
    expect(await getDb().select().from(ahClues)).toEqual([]);
    expect(await getDb().select().from(ahAuditLogs)).toEqual([]);
  });
});

describe("GET /api/algohunt/clues (public)", () => {
  it.each<EventStatus>(["DRAFT", "CHECK_IN", "READY"])("%s: not visible and sends no clues", async (status) => {
    const f = await seedFixture({ codes: 6, eventStatus: status });
    await replaceClues({ eventId: f.event.id, entries: parseClueLines(CLUES_TEXT), adminId: "admin-1" });
    const { status: http, json, text } = await fetchPublic(`?event=${f.event.slug}`);
    expect(http).toBe(200);
    expect(json).toMatchObject({ ok: true, visible: false, final: false, clues: [], openCount: 0, total: 0 });
    expect(json.event).toEqual({ name: "Fixture hunt", status, endsAt: null });
    expect(text).not.toContain("open no doors");
  });

  it("LIVE: visible with live statuses, no-store", async () => {
    const f = await seedFixture({ codes: 6 });
    await seedLinkedClues(f);
    const res = await publicCluesRoute(publicRequest(`?event=${f.event.slug}`));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json() as PublicClueBook;
    expect(json).toMatchObject({ visible: true, final: false, openCount: 2, total: 4 });
    expect(json.clues.map((c) => c.status)).toEqual(["FOUND", "UNAVAILABLE", "OPEN", "OPEN"]);
  });

  it("PAUSED before the end: still visible and not final", async () => {
    const f = await seedFixture({ codes: 6, eventStatus: "PAUSED" });
    await seedLinkedClues(f);
    await setEvent(f.event.id, { endsAt: Date.now() + 600_000 });
    expect((await fetchPublic(`?event=${f.event.slug}`)).json).toMatchObject({ visible: true, final: false, total: 4 });
  });

  it("time up (still LIVE) and ENDED: final statuses", async () => {
    const f = await seedFixture({ codes: 6 });
    await seedLinkedClues(f);
    await setEvent(f.event.id, { endsAt: Date.now() - 1_000 });
    const timeUp = (await fetchPublic(`?event=${f.event.slug}`)).json;
    expect(timeUp).toMatchObject({ visible: true, final: true, openCount: 2, total: 4 });
    expect(timeUp.clues.map((c) => c.status)).toEqual(["FOUND", "UNAVAILABLE", "OPEN", "OPEN"]);

    await setEvent(f.event.id, { status: "ENDED", endedAt: Date.now() });
    expect((await fetchPublic(`?event=${f.event.slug}`)).json).toMatchObject({ visible: true, final: true, total: 4 });
  });

  it("never carries codes, serials, placement notes, teams or ids", async () => {
    const f = await seedFixture({ codes: 6 });
    await seedLinkedClues(f);
    const { text, json } = await fetchPublic(`?event=${f.event.slug}`);
    const keys = allKeys(json);
    for (const key of ["id", "eventId", "code", "codes", "serial", "placementNote", "teamId", "teamName", "usedByTeamId", "slug"]) {
      expect(keys.has(key), key).toBe(false);
    }
    const clueIds = (await getDb().select({ id: ahClues.id }).from(ahClues)).map((r) => r.id);
    for (const secret of [
      ...f.codes.map((c) => c.code), ...f.codes.map((c) => c.id), ...clueIds,
      f.event.id, f.event.slug, ...f.teams.flatMap((t) => [t.team.id, t.team.teamName, t.team.teamCode]),
      "Behind the vending machine", "Under the red bench", "Lift lobby", "Ground floor",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("without ?event= shows the running real event, else the newest real event; unknown slugs are 404", async () => {
    const older = await seedFixture({ codes: 0, eventStatus: "LIVE" });
    const newer = await seedFixture({ codes: 0, eventStatus: "READY" });
    const test = await seedFixture({ codes: 0, eventStatus: "LIVE" }); // test events are never the default
    await setEvent(older.event.id, { isTest: false, name: "Real hunt", createdAt: 1_000 });
    await setEvent(newer.event.id, { isTest: false, name: "Next hunt", createdAt: 2_000 });
    expect((await resolveClueBookEvent(null))?.id).toBe(older.event.id);
    expect((await fetchPublic()).json.event.name).toBe("Real hunt");

    await setEvent(older.event.id, { status: "ENDED", endedAt: Date.now() });
    expect((await fetchPublic()).json.event.name).toBe("Next hunt");
    expect((await resolveClueBookEvent(test.event.slug))?.id).toBe(test.event.id);

    const missing = await fetchPublic("?event=no-such-hunt");
    expect(missing.status).toBe(404);
    expect(missing.json.ok).toBe(false);
  });

  it("is rate limited per IP", async () => {
    const f = await seedFixture({ codes: 0 });
    await getDb().insert(rateLimits).values({ key: "ah:clues:ip:203.0.113.7", count: 1_200, resetAt: Date.now() + 30_000 });
    const res = await publicCluesRoute(publicRequest(`?event=${f.event.slug}`));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    const other = await publicCluesRoute(new Request(`https://chapter.example/api/algohunt/clues?event=${f.event.slug}`, {
      headers: { "x-forwarded-for": "198.51.100.20" },
    }));
    expect(other.status).toBe(200);
  });
});
