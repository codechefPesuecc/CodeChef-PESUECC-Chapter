process.env.DATABASE_URL = ":memory:";

import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChallengeRowInput } from "@/lib/algohunt/question-schema";
import { getDb } from "@/server/db";
import { ahChallenges, ahEvents, ahStages, ahSubmissions, ahTestCases, type AhEvent } from "@/server/db/schema";
import { resetAlgoHuntTables, setupTestDb } from "../testing/db";
import { seedFixture, solveCurrent } from "../testing/fixtures";
import { checkTestChunk, groupTestRows, insertTestChunk, upsertChallengeRow, verifyChallenge } from "./challenges";
import { getContentReport } from "./content";
import { buildExport } from "./exports";
import { replaceStageOrder, validateStageOrder } from "./stages";

vi.mock("@/server/judge", () => ({
  judgeTests: vi.fn(async (p: { code: string; tests: unknown[] }) => (p.code.includes("GOOD")
    ? { verdict: "AC", passed: p.tests.length, total: p.tests.length }
    : { verdict: "WA", passed: 1, total: p.tests.length, failedOn: 2 })),
}));

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

function row(slug: string, overrides: Partial<ChallengeRowInput> = {}): ChallengeRowInput {
  return {
    schemaVersion: 1, slug, title: `Title ${slug}`, difficulty: "Easy", timeLimit: "1s", memoryLimit: "256MB",
    author: "Setter", statement: "Print **N**.", samples: [{ input: "1\n", output: "1\n", explanation: "One." }],
    referenceSolution: { language: "cpp", code: "GOOD" }, sourceSha256: "a".repeat(64),
    ...overrides,
  } as ChallengeRowInput;
}

async function draftEvent(status = "DRAFT"): Promise<AhEvent> {
  const fixture = await seedFixture({ eventStatus: "LIVE", teams: 0, codes: 0, stages: 0 });
  const [event] = await getDb().update(ahEvents).set({ status }).where(eq(ahEvents.id, fixture.event.id)).returning();
  return event;
}

const tests = (n: number, sample = false) => Array.from({ length: n }, (_, i) => ({ input: `${i}\n`, output: `${i}\n`, isSample: sample }));

describe("question import", () => {
  it("creates a question with pre-rendered, sanitised HTML and no verification yet", async () => {
    const event = await draftEvent();
    const res = await upsertChallengeRow({ event, row: row("q1", { statement: "Hi <script>x</script> **bold**" }), adminId: "admin" });
    expect(res).toMatchObject({ ok: true, replaced: false });
    const [stored] = await getDb().select().from(ahChallenges).where(eq(ahChallenges.slug, "q1"));
    expect(stored.verifiedAt).toBeNull();
    expect(stored.contentHtml).toContain("<strong>bold</strong>");
    expect(stored.contentHtml).not.toContain("<script>");
  });

  it("re-importing replaces the row and its tests; refused once teams submitted or the event is live", async () => {
    const event = await draftEvent();
    const first = await upsertChallengeRow({ event, row: row("q1"), adminId: "admin" });
    if (!first.ok) throw new Error(first.message);
    await insertTestChunk({ challengeId: first.challengeId, startIdx: 0, tests: tests(6) });
    const again = await upsertChallengeRow({ event, row: row("q1", { title: "New title" }), adminId: "admin" });
    expect(again).toMatchObject({ ok: true, replaced: true, challengeId: first.challengeId });
    expect(await getDb().select().from(ahTestCases).where(eq(ahTestCases.challengeId, first.challengeId))).toHaveLength(0);

    const live = { ...event, status: "LIVE" };
    expect(await upsertChallengeRow({ event: live, row: row("q2"), adminId: "admin" })).toMatchObject({ ok: false, code: "CONFLICT" });

    const fixture = await seedFixture({ stages: 1, teams: 1, codes: 0 });
    await getDb().insert(ahSubmissions).values({
      id: "sub-1", eventId: fixture.event.id, teamId: fixture.teams[0].team.id, stageId: fixture.stages[0].id,
      challengeId: fixture.challenges[0].id, language: "cpp", code: "x", status: "DONE", createdAt: Date.now(),
    });
    const draftFixtureEvent = { ...fixture.event, status: "READY" };
    expect(await upsertChallengeRow({ event: draftFixtureEvent, row: row("question-1"), adminId: "admin" }))
      .toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("checks and groups test chunks within D1's limits", () => {
    expect(checkTestChunk([])).toMatch(/at least one/);
    expect(checkTestChunk(tests(31))).toMatch(/At most 30/);
    expect(checkTestChunk([{ input: "x".repeat(500_001), output: "", isSample: false }])).toMatch(/input is over/);
    expect(checkTestChunk(tests(30))).toBeNull();
    expect(groupTestRows(tests(30)).map((g) => g.length)).toEqual([14, 14, 2]);
    const big = Array.from({ length: 5 }, () => ({ input: "x".repeat(450_000), output: "y".repeat(50_000) }));
    expect(groupTestRows(big).map((g) => g.length)).toEqual([3, 2]);
  });

  it("stores chunks in one batch, refuses overlapping indexes, and clears verification", async () => {
    const event = await draftEvent();
    const res = await upsertChallengeRow({ event, row: row("q1"), adminId: "admin" });
    if (!res.ok) throw new Error(res.message);
    expect(await insertTestChunk({ challengeId: res.challengeId, startIdx: 0, tests: tests(1, true) })).toMatchObject({ ok: true, inserted: 1 });
    expect(await insertTestChunk({ challengeId: res.challengeId, startIdx: 1, tests: tests(20) })).toMatchObject({ ok: true, inserted: 20 });
    expect(await insertTestChunk({ challengeId: res.challengeId, startIdx: 5, tests: tests(2) })).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await getDb().select().from(ahTestCases).where(eq(ahTestCases.challengeId, res.challengeId))).toHaveLength(21);
  });

  it("verifies on the judge: AC sets verifiedAt; a wrong reference doesn't", async () => {
    const event = await draftEvent();
    for (const [slug, code] of [["good", "GOOD"], ["bad", "BAD"]] as const) {
      const res = await upsertChallengeRow({ event, row: row(slug, { referenceSolution: { language: "cpp", code } }), adminId: "admin" });
      if (!res.ok) throw new Error(res.message);
      await insertTestChunk({ challengeId: res.challengeId, startIdx: 0, tests: tests(6) });
      const [challenge] = await getDb().select().from(ahChallenges).where(eq(ahChallenges.id, res.challengeId));
      const report = await verifyChallenge({ challenge, adminId: "admin" });
      const [after] = await getDb().select().from(ahChallenges).where(eq(ahChallenges.id, res.challengeId));
      if (code === "GOOD") {
        expect(report).toMatchObject({ verified: true, reference: { verdict: "AC", passed: 6, total: 6 } });
        expect(after.verifiedAt).not.toBeNull();
      } else {
        expect(report).toMatchObject({ verified: false, reference: { verdict: "WA", failedOn: 2 } });
        expect(report.warnings[0]).toMatch(/WA on test 2/);
        expect(after.verifiedAt).toBeNull();
      }
    }
  });
});

describe("question order", () => {
  it("validates numbering, slugs and points", () => {
    const slugs = new Set(["a", "b", "c"]);
    expect(validateStageOrder([{ stageNumber: 1, challengeSlug: "a" }, { stageNumber: 2, challengeSlug: "b" }, { stageNumber: 3, challengeSlug: "c" }], { slugs }).errors).toEqual([]);
    expect(validateStageOrder([{ stageNumber: 1, challengeSlug: "a" }, { stageNumber: 3, challengeSlug: "b" }], { slugs }).errors[0]).toMatch(/exactly 1 to 2/);
    expect(validateStageOrder([{ stageNumber: 1, challengeSlug: "a" }, { stageNumber: 2, challengeSlug: "a" }], { slugs }).errors).toContain("'a' is used more than once.");
    expect(validateStageOrder([{ stageNumber: 1, challengeSlug: "zzz" }], { slugs }).errors[0]).toMatch(/isn't imported/);
    expect(validateStageOrder([{ stageNumber: 1, challengeSlug: "a" }], { slugs, unverified: new Set(["a"]) }).warnings).toHaveLength(2);
  });

  it("replaces the order with the last question as the only final; refused once a team has played", async () => {
    const event = await draftEvent();
    for (const slug of ["a", "b", "c"]) await upsertChallengeRow({ event, row: row(slug), adminId: "admin" });
    const res = await replaceStageOrder({
      event, adminId: "admin",
      rows: [{ stageNumber: 1, challengeSlug: "c" }, { stageNumber: 2, challengeSlug: "a", points: 250 }, { stageNumber: 3, challengeSlug: "b" }],
    });
    expect(res).toEqual({ ok: true, stages: 3 });
    const stages = await getDb().select().from(ahStages).where(eq(ahStages.eventId, event.id));
    expect(stages.filter((s) => s.isFinal).map((s) => s.stageNumber)).toEqual([3]);
    expect(stages.find((s) => s.stageNumber === 2)?.points).toBe(250);

    const played = await seedFixture({ stages: 2, teams: 1, codes: 0 });
    await solveCurrent(played);
    const blocked = await replaceStageOrder({ event: { ...played.event, status: "READY" }, adminId: "admin", rows: [{ stageNumber: 1, challengeSlug: "question-1" }] });
    expect(blocked).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});

describe("content readiness", () => {
  it("is NOT READY without questions, teams or codes, and READY once everything is in place", async () => {
    const empty = await draftEvent();
    const report = await getContentReport(empty);
    expect(report.ready).toBe(false);
    expect(report.problems.join(" ")).toMatch(/No questions/);

    const fixture = await seedFixture({ stages: 2, teams: 3, codes: 2 });
    const notVerified = await getContentReport(fixture.event);
    expect(notVerified.problems.join(" ")).toMatch(/Not verified/);
    await getDb().update(ahChallenges).set({ verifiedAt: Date.now() });
    const now = Date.now();
    for (const challenge of fixture.challenges) {
      await getDb().insert(ahTestCases).values(tests(5).map((t, i) => ({ id: `${challenge.id}-${i}`, challengeId: challenge.id, idx: i + 1, ...t, createdAt: now })));
    }
    const ready = await getContentReport({ ...fixture.event, endsAt: now + 3_600_000 });
    expect(ready.problems).toEqual([]);
    expect(ready.ready).toBe(true);
    expect(ready.warnings.join(" ")).toMatch(/2 active codes for 3 teams/);
  });
});

describe("exports", () => {
  function sheet(buffer: Uint8Array): unknown[][] {
    const wb = XLSX.read(buffer, { type: "array" });
    return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  }

  it("builds every type; submissions carry no source code; codes lists every code; results rank teams", async () => {
    const fixture = await seedFixture({ stages: 2, teams: 2, codes: 4 });
    await getDb().insert(ahSubmissions).values({
      id: "sub-1", eventId: fixture.event.id, teamId: fixture.teams[0].team.id, stageId: fixture.stages[0].id,
      challengeId: fixture.challenges[0].id, language: "cpp", code: "SECRET_SOURCE_CODE", status: "DONE", verdict: "AC",
      passed: 1, total: 1, createdAt: Date.now(),
    });
    await solveCurrent(fixture);
    for (const type of ["results", "submissions", "codes", "code_attempts", "audit", "teams"] as const) {
      const { filename, buffer } = await buildExport(fixture.event, type);
      expect(filename).toBe(`algohunt-${type}-${fixture.event.slug}.xlsx`);
      const rows = sheet(buffer);
      expect(rows.length).toBeGreaterThan(0);
      const text = JSON.stringify(rows);
      expect(text).not.toContain("SECRET_SOURCE_CODE");
      expect(text).not.toContain("pbkdf2$");
      if (type === "codes") expect(rows.length - 1).toBe(4);
      if (type === "results") expect(rows[1]).toEqual(expect.arrayContaining([1, "Team Alpha"]));
    }
  });
});
