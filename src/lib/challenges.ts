import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@/server/db";
import { challenges as challengesTable, type ChallengeRow } from "@/server/db/schema";

/**
 * Problem records, read from the database (Cloudflare D1 in prod, the libSQL file
 * in dev). One row per problem holds the statement (Markdown), samples, AND the
 * hidden tests + checker. Publishing a problem is an insert (see
 * `scripts/seed-challenges.ts`), not a redeploy.
 *
 * These readers run on the server. The hidden `tests`/`checker` are only returned
 * by the full-record readers (`getChallengeBySlug`, `getDailyChallenge`, …) that
 * the judge uses; listings use `getReleasedSummaries` and the client only ever
 * receives `toPublicContent` fields — hidden data never reaches the browser.
 */

export interface TestCase {
  input: string;
  output: string;
}

export interface Sample extends TestCase {
  explanation?: string;
}

export interface Checker {
  type: "exact" | "token" | "float";
  epsilon?: number;
}

/**
 * Pre-rendered, sanitized HTML for a challenge's prose, built once at seed time so
 * the request path serves stored HTML instead of running the Markdown pipeline on
 * every load. Fields are empty strings when absent; `sampleExplanations` is parallel
 * to `samples`.
 */
export interface RenderedContent {
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleExplanations: string[];
}

/** Fields safe to render to solvers. */
export interface ChallengeContent {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  date: string; // YYYY-MM-DD
  timeLimit?: string;
  memoryLimit?: string;
  author?: string;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  samples: Sample[];
  /** Rendered HTML for the prose fields above (see RenderedContent). */
  contentHtml: RenderedContent;
}

export interface Challenge extends ChallengeContent {
  checker: Checker;
  /** Hidden tests — server-side only, never serialized to the client. */
  tests: TestCase[];
}

/** Lightweight shape for listings — no statement/samples/tests/checker. */
export interface ChallengeSummary {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  date: string;
  author?: string;
}

/** IST is UTC+5:30 and never observes DST, so a fixed offset is exact. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Today's date as YYYY-MM-DD in IST — the chapter runs on India time, so the
 * Problem of the Day rolls over at IST midnight (not UTC midnight). Derived from
 * the epoch plus a fixed offset and read with getUTC*, so it's independent of the
 * server's own timezone (Cloudflare Workers run in UTC).
 */
export function todayStr(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

/** Current year-month "YYYY-MM" in IST — for month-scoped aggregates. */
export function istYearMonth(): string {
  return todayStr().slice(0, 7);
}

/** A challenge is live once its date has arrived — future-dated problems (and
 * their hidden tests) are never served, so a problem queued for a later date
 * doesn't leak through the app before then. */
export function isReleased(c: { date: string }): boolean {
  return c.date <= todayStr();
}

// ── Row → domain mapping ──────────────────────────────────────────────────
// JSON columns (tags/samples/tests/checker) are stored as text; parse defensively
// so one malformed row can't throw the whole page.

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

function normalizeSamples(raw: unknown): Sample[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      input: typeof o.input === "string" ? o.input : "",
      output: typeof o.output === "string" ? o.output : "",
      explanation:
        typeof o.explanation === "string" && o.explanation ? o.explanation : undefined,
    };
  });
}

function normalizeTests(raw: unknown): TestCase[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const o = (t ?? {}) as Record<string, unknown>;
    return {
      input: typeof o.input === "string" ? o.input : "",
      output: typeof o.output === "string" ? o.output : "",
    };
  });
}

function normalizeChecker(raw: unknown): Checker {
  const o = (raw ?? {}) as { type?: unknown; epsilon?: unknown };
  const type = o.type === "exact" || o.type === "float" ? o.type : "token";
  return { type, epsilon: typeof o.epsilon === "number" ? o.epsilon : undefined };
}

function normalizeRenderedContent(raw: unknown): RenderedContent {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    statement: str(o.statement),
    inputFormat: str(o.inputFormat),
    outputFormat: str(o.outputFormat),
    constraints: str(o.constraints),
    sampleExplanations: Array.isArray(o.sampleExplanations)
      ? o.sampleExplanations.map(str)
      : [],
  };
}

function rowToChallenge(r: ChallengeRow): Challenge {
  return {
    slug: r.slug,
    title: r.title,
    difficulty: r.difficulty,
    tags: normalizeTags(safeJson<unknown>(r.tags, [])),
    date: r.date,
    timeLimit: r.timeLimit ?? undefined,
    memoryLimit: r.memoryLimit ?? undefined,
    author: r.author ?? undefined,
    statement: r.statement,
    inputFormat: r.inputFormat ?? undefined,
    outputFormat: r.outputFormat ?? undefined,
    constraints: r.constraints ?? undefined,
    samples: normalizeSamples(safeJson<unknown>(r.samples, [])),
    contentHtml: normalizeRenderedContent(safeJson<unknown>(r.contentHtml, {})),
    checker: normalizeChecker(safeJson<unknown>(r.checker, {})),
    tests: normalizeTests(safeJson<unknown>(r.tests, [])),
  };
}

// ── Readers ───────────────────────────────────────────────────────────────
// `date desc, created_at desc` gives a deterministic "most recent" ordering even
// if two problems share a date.

/** Every problem, newest first (includes unreleased — admin/debug use). */
export async function getAllChallenges(): Promise<Challenge[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(challengesTable)
    .orderBy(desc(challengesTable.date), desc(challengesTable.createdAt));
  return rows.map(rowToChallenge);
}

/** Released problems, newest first (full records). */
export async function getReleasedChallenges(): Promise<Challenge[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(challengesTable)
    .where(lte(challengesTable.date, todayStr()))
    .orderBy(desc(challengesTable.date), desc(challengesTable.createdAt));
  return rows.map(rowToChallenge);
}

/** Released problems as lightweight summaries — for listing pages (no hidden
 * data selected at all). */
export async function getReleasedSummaries(): Promise<ChallengeSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      slug: challengesTable.slug,
      title: challengesTable.title,
      difficulty: challengesTable.difficulty,
      tags: challengesTable.tags,
      date: challengesTable.date,
      author: challengesTable.author,
    })
    .from(challengesTable)
    .where(lte(challengesTable.date, todayStr()))
    .orderBy(desc(challengesTable.date), desc(challengesTable.createdAt));
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    difficulty: r.difficulty,
    tags: normalizeTags(safeJson<unknown>(r.tags, [])),
    date: r.date,
    author: r.author ?? undefined,
  }));
}

/** The Problem of the Day — the most recent released challenge. */
export async function getDailyChallenge(): Promise<Challenge | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(challengesTable)
    .where(lte(challengesTable.date, todayStr()))
    .orderBy(desc(challengesTable.date), desc(challengesTable.createdAt))
    .limit(1);
  return rows[0] ? rowToChallenge(rows[0]) : null;
}

/** A single released challenge by slug (unreleased slugs resolve to null, so
 * they can't be run or submitted to). */
export async function getChallengeBySlug(slug: string): Promise<Challenge | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(challengesTable)
    .where(and(eq(challengesTable.slug, slug), lte(challengesTable.date, todayStr())))
    .limit(1);
  return rows[0] ? rowToChallenge(rows[0]) : null;
}

/** Titles for a set of slugs in one query — for rendering submission history
 * without an N+1 per-row lookup. Slugs with no matching row are simply absent. */
export async function getChallengeTitles(
  slugs: string[],
): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({ slug: challengesTable.slug, title: challengesTable.title })
    .from(challengesTable)
    .where(inArray(challengesTable.slug, slugs));
  return new Map(rows.map((r) => [r.slug, r.title]));
}

/** Strips hidden fields — only these ever reach the client. */
export function toPublicContent(c: Challenge): ChallengeContent {
  return {
    slug: c.slug,
    title: c.title,
    difficulty: c.difficulty,
    tags: c.tags,
    date: c.date,
    timeLimit: c.timeLimit,
    memoryLimit: c.memoryLimit,
    author: c.author,
    statement: c.statement,
    inputFormat: c.inputFormat,
    outputFormat: c.outputFormat,
    constraints: c.constraints,
    samples: c.samples,
    contentHtml: c.contentHtml,
  };
}

/**
 * Parses a time limit like "1s", "2 s", or "500ms" into milliseconds. Falls back
 * to `fallback` when absent or unparseable.
 */
export function parseTimeLimitMs(timeLimit: string | undefined, fallback = 2000): number {
  if (!timeLimit) return fallback;
  const match = timeLimit.trim().match(/^([\d.]+)\s*(ms|s)?$/i);
  if (!match) return fallback;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return fallback;
  const unit = (match[2] ?? "s").toLowerCase();
  return Math.round(unit === "ms" ? value : value * 1000);
}

/**
 * Parses a memory limit like "256 MB", "256MiB", "512m", or a raw byte count
 * into bytes. Units are treated as binary (MB = MiB = 1024², the CP convention).
 * Falls back to `fallback` when absent or unparseable.
 */
export function parseMemoryLimitBytes(
  memoryLimit: string | undefined,
  fallback: number,
): number {
  if (!memoryLimit) return fallback;
  const match = memoryLimit.trim().match(/^([\d.]+)\s*(k|m|g)?i?b?$/i);
  if (!match) return fallback;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return fallback;
  const unit = (match[2] ?? "").toLowerCase();
  const mult =
    unit === "g" ? 1024 ** 3 : unit === "m" ? 1024 ** 2 : unit === "k" ? 1024 : 1;
  return Math.round(value * mult);
}
