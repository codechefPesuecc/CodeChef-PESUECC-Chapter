/**
 * AlgoHunt challenge server helpers (Module 2).
 * Loads the current challenge, builds view models, and prepares judge inputs.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahChallenges, ahStages, ahTestCases, type AhChallenge, type AhStage } from "@/server/db/schema";
import type { ChallengeView, LanguageOption } from "@/lib/algohunt/types";
import { parseTimeLimitMs, parseMemoryLimitBytes } from "@/lib/challenges";
import type { Checker, TestCase, ChallengeContent, RenderedContent } from "@/lib/challenges";
import { JUDGE_LANGUAGE } from "@/lib/judge";
import { ARENA_LANGUAGES } from "@/components/cp-arena/mockData";

// ── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_MEM_BYTES = 256 * 1024 * 1024;
const MIN_MEM_BYTES = 32 * 1024 * 1024;
const MAX_MEM_BYTES = 512 * 1024 * 1024;
const MIN_TIME_MS = 500;
const MAX_TIME_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface StageChallenge {
  stage: AhStage;
  challenge: AhChallenge;
}

export interface JudgeInput {
  tests: TestCase[];
  /** How many of the first tests are samples (shown to teams, so their output may be too). */
  sampleCount: number;
  checker: Checker;
  timeLimitMs: number;
  memLimitBytes: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function paragraph(text: string | null | undefined): string {
  if (!text) return "";
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<p>${escaped}</p>`;
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
      ? o.sampleExplanations.map((x: unknown) => (typeof x === "string" ? x : ""))
      : [],
  };
}

// ── DB queries ────────────────────────────────────────────────────────────

/** The stage and its question, or null when the stage doesn't exist. */
export async function getStageChallenge(stageId: string): Promise<StageChallenge | null> {
  const [row] = await getDb().select({ stage: ahStages, challenge: ahChallenges })
    .from(ahStages)
    .innerJoin(ahChallenges, eq(ahStages.challengeId, ahChallenges.id))
    .where(eq(ahStages.id, stageId))
    .limit(1);
  return row ?? null;
}

/** The time and memory limits a run or submission is judged with, clamped to the judge's range. */
export function judgeLimits(challenge: AhChallenge): { timeLimitMs: number; memLimitBytes: number } {
  const rawMs = parseTimeLimitMs(challenge.timeLimit, 2000);
  const rawBytes = parseMemoryLimitBytes(challenge.memoryLimit, DEFAULT_MEM_BYTES);
  return {
    timeLimitMs: Math.min(Math.max(rawMs, MIN_TIME_MS), MAX_TIME_MS),
    memLimitBytes: Math.min(Math.max(rawBytes, MIN_MEM_BYTES), MAX_MEM_BYTES),
  };
}

/**
 * Every stored test of a question, samples first (ordered by idx), with the checker and limits.
 * A database error propagates: judging against fewer tests than stored must never happen.
 */
export async function loadJudgeInput(challenge: AhChallenge): Promise<JudgeInput> {
  const rows = await getDb().select({ input: ahTestCases.input, output: ahTestCases.output, isSample: ahTestCases.isSample })
    .from(ahTestCases)
    .where(eq(ahTestCases.challengeId, challenge.id))
    .orderBy(asc(ahTestCases.idx));
  return {
    tests: rows.map((row) => ({ input: row.input, output: row.output })),
    sampleCount: rows.filter((row) => row.isSample).length,
    checker: normalizeChecker(safeJson(challenge.checker, {})),
    ...judgeLimits(challenge),
  };
}

/**
 * Determine the allowed languages for a challenge:
 * challenge.languages ∩ ARENA_LANGUAGES ∩ JUDGE_LANGUAGE.
 * If challenge.languages is null → all ARENA_LANGUAGES that are in JUDGE_LANGUAGE.
 */
export function allowedLanguages(challenge: AhChallenge): LanguageOption[] {
  const parsed = challenge.languages ? safeJson<unknown>(challenge.languages, null) : null;
  // The validator accepts "CPP" as well as "cpp", so compare case-insensitively.
  const challengeLangs = Array.isArray(parsed)
    ? parsed.filter((l): l is string => typeof l === "string").map((l) => l.toLowerCase())
    : null;

  return ARENA_LANGUAGES.filter((l) => {
    // Must be in JUDGE_LANGUAGE
    if (!JUDGE_LANGUAGE[l.id]) return false;
    // Must be in the challenge's language list (if specified)
    if (challengeLangs !== null && !challengeLangs.includes(l.id)) return false;
    return true;
  }).map((l) => ({ id: l.id, label: l.label }));
}

/**
 * Build the public ChallengeView for the team-facing API.
 * NEVER includes tests, checker, referenceSolution, bruteSolution, editorial, author.
 */
export function toChallengeView(
  sc: StageChallenge,
  opts: { solved: boolean },
): ChallengeView {
  const { stage, challenge } = sc;
  const rawMs = parseTimeLimitMs(challenge.timeLimit, 2000);
  const rawBytes = parseMemoryLimitBytes(challenge.memoryLimit, DEFAULT_MEM_BYTES);
  const timeLimitMs = Math.min(Math.max(rawMs, MIN_TIME_MS), MAX_TIME_MS);
  const memLimitBytes = Math.min(Math.max(rawBytes, MIN_MEM_BYTES), MAX_MEM_BYTES);
  const memoryLimitMb = Math.round(memLimitBytes / 1024 / 1024);

  // contentHtml: pre-rendered at import time by Module 6
  let contentHtml: RenderedContent;
  if (challenge.contentHtml) {
    contentHtml = normalizeRenderedContent(safeJson(challenge.contentHtml, {}));
  } else {
    console.warn("[algohunt:challenges] missing contentHtml for slug:", challenge.slug);
    contentHtml = {
      statement: "",
      inputFormat: "",
      outputFormat: "",
      constraints: "",
      sampleExplanations: [],
    };
  }

  // Parse samples (public)
  type RawSample = { input?: string; output?: string; explanation?: string };
  const rawSamples: RawSample[] = safeJson<RawSample[]>(challenge.samples, []);
  const samples = rawSamples.map((s, i) => ({
    input: typeof s.input === "string" ? s.input : "",
    output: typeof s.output === "string" ? s.output : "",
    explanationHtml: contentHtml.sampleExplanations[i] ?? "",
  }));

  return {
    stageNumber: stage.stageNumber,
    isFinal: stage.isFinal,
    title: challenge.title,
    difficulty: challenge.difficulty,
    html: {
      statement: contentHtml.statement,
      inputFormat: contentHtml.inputFormat,
      outputFormat: contentHtml.outputFormat,
      constraints: contentHtml.constraints,
    },
    samples,
    timeLimitMs,
    memoryLimitMb,
    languages: allowedLanguages(challenge),
    solved: opts.solved,
  };
}

/**
 * Build a ChallengeContent adapter so the existing ProblemStatement component
 * can render an AlgoHunt challenge. Author is omitted (setters are confidential).
 */
export function toChallengeContent(challenge: AhChallenge): ChallengeContent {
  let contentHtml: RenderedContent;
  if (challenge.contentHtml) {
    contentHtml = normalizeRenderedContent(safeJson(challenge.contentHtml, {}));
  } else {
    // No pre-rendered HTML (an old row): show the raw text, escaped, never as markup.
    contentHtml = {
      statement: paragraph(challenge.statement),
      inputFormat: paragraph(challenge.inputFormat),
      outputFormat: paragraph(challenge.outputFormat),
      constraints: paragraph(challenge.constraints),
      sampleExplanations: [],
    };
  }

  if (!contentHtml.statement && challenge.statement) {
    contentHtml.statement = paragraph(challenge.statement);
  }

  type RawSample = { input?: string; output?: string; explanation?: string };
  const rawSamples: RawSample[] = safeJson<RawSample[]>(challenge.samples, []);
  const samples = rawSamples.map((s) => ({
    input: typeof s.input === "string" ? s.input : "",
    output: typeof s.output === "string" ? s.output : "",
    explanation:
      typeof s.explanation === "string" && s.explanation ? s.explanation : undefined,
  }));

  return {
    slug: challenge.slug,
    title: challenge.title,
    difficulty: challenge.difficulty,
    tags: [],
    date: null,
    timeLimit: challenge.timeLimit,
    memoryLimit: challenge.memoryLimit,
    // author: intentionally omitted
    statement: challenge.statement,
    inputFormat: challenge.inputFormat ?? undefined,
    outputFormat: challenge.outputFormat ?? undefined,
    constraints: challenge.constraints ?? undefined,
    samples,
    contentHtml,
  };
}
