import fs from "node:fs";
import path from "node:path";

/**
 * Reads the GitOps problem records in `/challenges` — one JSON file per problem
 * containing the statement, samples, AND the hidden tests (see the flow: student
 * authors a JSON, a maintainer opens a PR, an admin merges). This runs on the
 * server; the hidden `tests` and `checker` are never handed to the client — only
 * the public content (`toPublicContent`) and, for the judge, the full record.
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
}

export interface Challenge extends ChallengeContent {
  checker: Checker;
  /** Hidden tests — server-side only, never serialized to the client. */
  tests: TestCase[];
}

const CHALLENGES_DIR = path.join(process.cwd(), "challenges");

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readChallengeFile(fileName: string): Challenge | null {
  const raw = fs.readFileSync(path.join(CHALLENGES_DIR, fileName), "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || !data.title || !data.date || !data.statement) {
    return null;
  }

  const samples: Sample[] = Array.isArray(data.samples)
    ? data.samples.map((s: unknown) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return { input: str(o.input), output: str(o.output), explanation: optStr(o.explanation) };
      })
    : [];

  const tests: TestCase[] = Array.isArray(data.tests)
    ? data.tests.map((t: unknown) => {
        const o = (t ?? {}) as Record<string, unknown>;
        return { input: str(o.input), output: str(o.output) };
      })
    : [];

  const checkerType = data.checker?.type;
  const checker: Checker = {
    type: checkerType === "exact" || checkerType === "float" ? checkerType : "token",
    epsilon: typeof data.checker?.epsilon === "number" ? data.checker.epsilon : undefined,
  };

  return {
    slug: str(data.slug, fileName.replace(/\.json$/, "")),
    title: str(data.title),
    difficulty: str(data.difficulty, "Unrated"),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    date: str(data.date),
    timeLimit: optStr(data.timeLimit),
    memoryLimit: optStr(data.memoryLimit),
    author: optStr(data.author),
    statement: str(data.statement),
    inputFormat: optStr(data.inputFormat),
    outputFormat: optStr(data.outputFormat),
    constraints: optStr(data.constraints),
    samples,
    checker,
    tests,
  };
}

/** All published challenges, newest first. */
export function getAllChallenges(): Challenge[] {
  let files: string[];
  try {
    files = fs.readdirSync(CHALLENGES_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".json"))
    .map(readChallengeFile)
    .filter((c): c is Challenge => c !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Today's date as YYYY-MM-DD (server local time). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A challenge is live once its date has arrived — future-dated problems (and
 * their hidden tests) are never served, so committing tomorrow's problem early
 * doesn't leak it through the app. */
export function isReleased(c: Challenge): boolean {
  return c.date <= todayStr();
}

/** Released challenges, newest first (for the archive). */
export function getReleasedChallenges(): Challenge[] {
  return getAllChallenges().filter(isReleased);
}

/** The Problem of the Day — the most recent released challenge. */
export function getDailyChallenge(): Challenge | null {
  return getReleasedChallenges()[0] ?? null;
}

/** A single released challenge by slug (unreleased slugs resolve to null, so
 * they can't be run or submitted to). */
export function getChallengeBySlug(slug: string): Challenge | null {
  const c = getAllChallenges().find((x) => x.slug === slug);
  return c && isReleased(c) ? c : null;
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
  };
}

/**
 * Parses a frontmatter time limit like "1s", "2 s", or "500ms" into
 * milliseconds. Falls back to `fallback` when absent or unparseable.
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
