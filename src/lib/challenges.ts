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

/** The Problem of the Day — the most recently dated published challenge. */
export function getDailyChallenge(): Challenge | null {
  return getAllChallenges()[0] ?? null;
}

/** A single published challenge by slug (server-side lookup for the judge). */
export function getChallengeBySlug(slug: string): Challenge | null {
  return getAllChallenges().find((c) => c.slug === slug) ?? null;
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
