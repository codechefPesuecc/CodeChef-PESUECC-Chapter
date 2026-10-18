import crypto from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { renderMarkdown } from "@/lib/markdown";
import { QUESTION_LIMITS, checkQuestion, type ChallengeRowInput } from "@/lib/algohunt/question-schema";
import type { AhVerdict, ErrorCode } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahChallenges, ahEvents, ahSubmissions, ahTestCases, type AhChallenge, type AhEvent } from "@/server/db/schema";
import { judgeTests } from "@/server/judge";
import { auditInsert, writeAudit } from "../audit";
import { loadJudgeInput } from "../challenges";

/**
 * Question import (M6 brief §5.2). A question goes up in pieces because of D1's limits: the row
 * first (statement, samples, solutions), then its tests in chunks, then a verification run of the
 * reference solution on Akiro. Test data and solutions never leave the server.
 */

/** Statuses in which questions may still change. From LIVE on, content is frozen. */
export const CONTENT_EDITABLE_STATUSES = new Set(["DRAFT", "CHECK_IN", "READY"]);

export const TEST_CHUNK_LIMITS = {
  maxRows: 30,
  maxChars: 4_000_000,
  /** One INSERT carries at most this many rows (7 columns × 14 = 98 bound params, D1 allows 100). */
  rowsPerStatement: 14,
  /** And at most this many characters of input + output, under D1's 2 MB statement/row ceiling. */
  charsPerStatement: 1_900_000,
} as const;

type Failure = { ok: false; code: ErrorCode; message: string };

export type ImportFailure = Failure;

/** Validate only: the full question JSON, tests included. Nothing is stored. */
export function validateQuestion(raw: unknown) {
  return checkQuestion(raw);
}

/**
 * Create or replace a question's row (no tests). Replacing deletes the old tests and clears
 * verifiedAt. Refused once the event is live, and for a question teams have already submitted to.
 */
export async function upsertChallengeRow(p: { event: AhEvent; row: ChallengeRowInput; adminId: string }): Promise<
  { ok: true; challengeId: string; replaced: boolean } | Failure
> {
  const { event, row } = p;
  if (!CONTENT_EDITABLE_STATUSES.has(event.status)) {
    return { ok: false, code: "CONFLICT", message: "Questions are frozen once the event has started." };
  }
  const db = getDb();
  const [existing] = await db.select({ id: ahChallenges.id, createdAt: ahChallenges.createdAt }).from(ahChallenges)
    .where(and(eq(ahChallenges.eventId, event.id), eq(ahChallenges.slug, row.slug))).limit(1);
  if (existing) {
    const [{ total }] = await db.select({ total: count() }).from(ahSubmissions)
      .where(eq(ahSubmissions.challengeId, existing.id));
    if (total > 0) {
      return { ok: false, code: "CONFLICT", message: `Teams have already submitted to '${row.slug}', so it can't be replaced.` };
    }
  }

  const now = Date.now();
  const contentHtml = JSON.stringify({
    statement: await renderMarkdown(row.statement),
    inputFormat: await renderMarkdown(row.inputFormat ?? ""),
    outputFormat: await renderMarkdown(row.outputFormat ?? ""),
    constraints: await renderMarkdown(row.constraints ?? ""),
    sampleExplanations: await Promise.all(row.samples.map((s) => renderMarkdown(s.explanation ?? ""))),
  });
  const values = {
    title: row.title,
    difficulty: row.difficulty,
    statement: row.statement,
    inputFormat: row.inputFormat ?? null,
    outputFormat: row.outputFormat ?? null,
    constraints: row.constraints ?? null,
    samples: JSON.stringify(row.samples),
    contentHtml,
    checker: JSON.stringify(row.checker ?? { type: "token" }),
    timeLimit: row.timeLimit,
    memoryLimit: row.memoryLimit,
    languages: row.languages ? JSON.stringify(row.languages) : null,
    referenceSolution: JSON.stringify(row.referenceSolution),
    bruteSolution: row.bruteSolution ? JSON.stringify(row.bruteSolution) : null,
    editorial: row.editorial ?? null,
    author: row.author,
    verifiedAt: null,
    sourceSha256: row.sourceSha256,
    updatedAt: now,
  };
  const challengeId = existing?.id ?? crypto.randomUUID();
  const audit = auditInsert(db, {
    eventId: event.id, actorType: "ADMIN", actorId: p.adminId, action: "import.challenge",
    targetType: "challenge", targetId: challengeId, metadata: { slug: row.slug, replaced: Boolean(existing) },
  });
  if (existing) {
    await db.batch([
      db.delete(ahTestCases).where(eq(ahTestCases.challengeId, challengeId)),
      db.update(ahChallenges).set(values).where(eq(ahChallenges.id, challengeId)),
      audit,
    ]);
  } else {
    await db.batch([
      db.insert(ahChallenges).values({ id: challengeId, eventId: event.id, slug: row.slug, ...values, createdAt: now }),
      audit,
    ]);
  }
  return { ok: true, challengeId, replaced: Boolean(existing) };
}

export interface TestRowInput {
  input: string;
  output: string;
  isSample: boolean;
}

/** Problems with one chunk of test rows, before anything touches the database. Pure. */
export function checkTestChunk(tests: readonly TestRowInput[]): string | null {
  if (tests.length === 0) return "Send at least one test.";
  if (tests.length > TEST_CHUNK_LIMITS.maxRows) return `At most ${TEST_CHUNK_LIMITS.maxRows} tests per upload.`;
  let chars = 0;
  for (const [i, t] of tests.entries()) {
    if (Buffer.byteLength(t.input) > QUESTION_LIMITS.maxInputChars) return `Test ${i + 1}: input is over ${QUESTION_LIMITS.maxInputChars} bytes.`;
    if (Buffer.byteLength(t.output) > QUESTION_LIMITS.maxOutputChars) return `Test ${i + 1}: output is over ${QUESTION_LIMITS.maxOutputChars} bytes.`;
    chars += t.input.length + t.output.length;
  }
  if (chars > TEST_CHUNK_LIMITS.maxChars) return `At most ${TEST_CHUNK_LIMITS.maxChars} characters per upload.`;
  return null;
}

/** Split rows into INSERT statements of ≤ 14 rows and ≤ 1.9M characters each. Pure. */
export function groupTestRows<T extends { input: string; output: string }>(rows: readonly T[]): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const row of rows) {
    const size = row.input.length + row.output.length;
    if (current.length > 0
      && (current.length >= TEST_CHUNK_LIMITS.rowsPerStatement || chars + size > TEST_CHUNK_LIMITS.charsPerStatement)) {
      groups.push(current);
      current = [];
      chars = 0;
    }
    current.push(row);
    chars += size;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Insert one chunk of tests at idx startIdx… (samples first, then the hidden tests). All of the
 * chunk's statements run in one batch, and adding tests clears verifiedAt.
 */
export async function insertTestChunk(p: { challengeId: string; startIdx: number; tests: TestRowInput[] }): Promise<
  { ok: true; inserted: number } | Failure
> {
  const problem = checkTestChunk(p.tests);
  if (problem) return { ok: false, code: "VALIDATION", message: problem };
  const db = getDb();
  const [challenge] = await db.select({ id: ahChallenges.id, status: ahEvents.status }).from(ahChallenges)
    .innerJoin(ahEvents, eq(ahChallenges.eventId, ahEvents.id))
    .where(eq(ahChallenges.id, p.challengeId)).limit(1);
  if (!challenge) return { ok: false, code: "NOT_FOUND", message: "Question not found." };
  if (!CONTENT_EDITABLE_STATUSES.has(challenge.status)) {
    return { ok: false, code: "CONFLICT", message: "Questions are frozen once the event has started." };
  }

  const now = Date.now();
  const rows = p.tests.map((t, i) => ({
    id: crypto.randomUUID(), challengeId: p.challengeId, idx: p.startIdx + i,
    input: t.input, output: t.output, isSample: t.isSample, createdAt: now,
  }));
  const [first, ...rest] = groupTestRows(rows).map((group) => db.insert(ahTestCases).values(group));
  try {
    await db.batch([
      db.update(ahChallenges).set({ verifiedAt: null, updatedAt: now }).where(eq(ahChallenges.id, p.challengeId)),
      first,
      ...rest,
    ]);
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : error))) {
      return { ok: false, code: "CONFLICT", message: "Some of these tests were already uploaded. Re-import the question to start over." };
    }
    throw error;
  }
  return { ok: true, inserted: rows.length };
}

export interface SolutionRun {
  verdict: AhVerdict;
  passed: number;
  total: number;
  failedOn?: number;
  wallMs: number;
}

export interface VerifyReport {
  reference: SolutionRun;
  brute?: SolutionRun;
  verified: boolean;
  warnings: string[];
}

function parseSolution(raw: string | null): { language: string; code: string } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { language?: unknown; code?: unknown };
    return typeof value.language === "string" && typeof value.code === "string"
      ? { language: value.language, code: value.code }
      : null;
  } catch {
    return null;
  }
}

/**
 * Run the reference (and the brute, if any) on Akiro against every stored test. Verified means the
 * reference is accepted within QUESTION_LIMITS.maxReferenceTotalMs; only then is verifiedAt set.
 */
export async function verifyChallenge(p: { challenge: AhChallenge; adminId: string }): Promise<VerifyReport> {
  const { challenge } = p;
  const input = await loadJudgeInput(challenge);
  const [{ stored }] = await getDb().select({ stored: count() }).from(ahTestCases)
    .where(eq(ahTestCases.challengeId, challenge.id));
  const warnings: string[] = [];

  async function run(solution: { language: string; code: string }): Promise<SolutionRun> {
    const started = Date.now();
    const result = await judgeTests({ ...input, language: solution.language, code: solution.code });
    return {
      verdict: result.verdict, passed: result.passed, total: result.total,
      ...(result.failedOn ? { failedOn: result.failedOn } : {}),
      wallMs: Date.now() - started,
    };
  }

  const reference = parseSolution(challenge.referenceSolution);
  let report: VerifyReport;
  if (stored === 0) {
    report = { reference: { verdict: "NO_TESTS", passed: 0, total: 0, wallMs: 0 }, verified: false, warnings: ["No tests are stored for this question. Re-import it."] };
  } else if (!reference) {
    report = { reference: { verdict: "ERR", passed: 0, total: stored, wallMs: 0 }, verified: false, warnings: ["The reference solution is missing. Re-import the question."] };
  } else {
    const ref = await run(reference);
    if (ref.verdict === "ERR") warnings.push("The judge could not run the reference. Check the judge health and try again.");
    else if (ref.verdict !== "AC") warnings.push(`The reference got ${ref.verdict}${ref.failedOn ? ` on test ${ref.failedOn}` : ""}: the tests or the reference are wrong.`);
    if (ref.verdict === "AC" && ref.wallMs > QUESTION_LIMITS.maxReferenceTotalMs) {
      warnings.push(`The reference took ${(ref.wallMs / 1000).toFixed(1)} s for all tests (limit ${QUESTION_LIMITS.maxReferenceTotalMs / 1000} s). Make the biggest tests smaller.`);
    }
    report = { reference: ref, verified: ref.verdict === "AC" && ref.wallMs <= QUESTION_LIMITS.maxReferenceTotalMs, warnings };

    const brute = parseSolution(challenge.bruteSolution);
    if (brute && ref.verdict === "AC") {
      const b = await run(brute);
      report.brute = b;
      if (b.verdict === "WA") warnings.push("The brute and the reference disagree: check the expected outputs.");
      else if (b.verdict === "TLE") warnings.push("The brute timed out on the big tests (fine: it is only a cross-check).");
    }
  }

  const now = Date.now();
  await getDb().update(ahChallenges).set({ verifiedAt: report.verified ? now : null, updatedAt: now })
    .where(eq(ahChallenges.id, challenge.id));
  await writeAudit({
    eventId: challenge.eventId, actorType: "ADMIN", actorId: p.adminId, action: "challenge.verified",
    targetType: "challenge", targetId: challenge.id,
    metadata: { slug: challenge.slug, verified: report.verified, wallMs: report.reference.wallMs },
  });
  return report;
}
