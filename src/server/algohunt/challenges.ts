/**
 * AlgoHunt challenge server helpers (Module 2).
 * Loads the current challenge, builds view models, and prepares judge inputs.
 */
import { getDb } from "@/server/db";
import type { AhChallenge, AhStage, AhTestCase } from "@/lib/algohunt/_mock-db-types";
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

/**
 * Fetch stage + challenge in a single join-like query.
 * NOTE: This uses the ah_* tables from Module 1's schema. Until M1 merges,
 * this will throw a "no such table" error, which is expected.
 */
export async function getStageChallenge(stageId: string): Promise<StageChallenge | null> {
  const db = getDb();
  // Drizzle query against ah_stages and ah_challenges (M1 schema).
  // We use raw SQL to avoid importing M1's schema tables before they exist.
  // TODO(M1): Replace with proper Drizzle join once M1's schema.ts is merged.
  try {
    const rows = await db.run(
      `SELECT s.id as stage_id, s.event_id, s.stage_number, s.challenge_id, s.points,
              s.is_final, s.enabled, s.created_at as stage_created_at, s.updated_at as stage_updated_at,
              c.id as ch_id, c.event_id as ch_event_id, c.slug, c.title, c.difficulty,
              c.statement, c.input_format, c.output_format, c.constraints, c.samples,
              c.content_html, c.checker, c.time_limit, c.memory_limit, c.languages,
              c.reference_solution, c.brute_solution, c.editorial, c.author,
              c.verified_at, c.source_sha256,
              c.created_at as ch_created_at, c.updated_at as ch_updated_at
       FROM ah_stages s
       JOIN ah_challenges c ON c.id = s.challenge_id
       WHERE s.id = ?
       LIMIT 1` as unknown as Parameters<typeof db.run>[0],
      [stageId],
    );
    const row = (rows as unknown as { rows?: unknown[] })?.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return rowToStageChallenge(row);
  } catch (e) {
    console.error("[algohunt:challenges] getStageChallenge error:", e);
    return null;
  }
}

function rowToStageChallenge(row: Record<string, unknown>): StageChallenge {
  const stage: AhStage = {
    id: String(row.stage_id ?? ""),
    eventId: String(row.event_id ?? ""),
    stageNumber: Number(row.stage_number ?? 0),
    challengeId: String(row.challenge_id ?? ""),
    points: Number(row.points ?? 100),
    isFinal: Boolean(row.is_final),
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
    createdAt: Number(row.stage_created_at ?? 0),
    updatedAt: Number(row.stage_updated_at ?? 0),
  };
  const challenge: AhChallenge = {
    id: String(row.ch_id ?? ""),
    eventId: String(row.ch_event_id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    difficulty: String(row.difficulty ?? "Unrated"),
    statement: String(row.statement ?? ""),
    inputFormat: row.input_format ? String(row.input_format) : null,
    outputFormat: row.output_format ? String(row.output_format) : null,
    constraints: row.constraints ? String(row.constraints) : null,
    samples: String(row.samples ?? "[]"),
    contentHtml: row.content_html ? String(row.content_html) : null,
    checker: String(row.checker ?? '{"type":"token"}'),
    timeLimit: String(row.time_limit ?? "2s"),
    memoryLimit: String(row.memory_limit ?? "256MB"),
    languages: row.languages ? String(row.languages) : null,
    referenceSolution: row.reference_solution ? String(row.reference_solution) : null,
    bruteSolution: row.brute_solution ? String(row.brute_solution) : null,
    editorial: row.editorial ? String(row.editorial) : null,
    author: row.author ? String(row.author) : null,
    verifiedAt: row.verified_at ? Number(row.verified_at) : null,
    sourceSha256: row.source_sha256 ? String(row.source_sha256) : null,
    createdAt: Number(row.ch_created_at ?? 0),
    updatedAt: Number(row.ch_updated_at ?? 0),
  };
  return { stage, challenge };
}

/**
 * Load all test cases for a challenge, ordered by idx (samples first).
 * Returns the checker and parsed limits.
 */
export async function loadJudgeInput(challenge: AhChallenge): Promise<JudgeInput> {
  const db = getDb();

  let rawTests: TestCase[] = [];
  try {
    const rows = await db.run(
      `SELECT input, output FROM ah_test_cases
       WHERE challenge_id = ?
       ORDER BY idx ASC` as unknown as Parameters<typeof db.run>[0],
      [challenge.id],
    );
    const resultRows = (rows as unknown as { rows?: unknown[] })?.rows ?? [];
    rawTests = resultRows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        input: String(row.input ?? ""),
        output: String(row.output ?? ""),
      };
    });
  } catch (e) {
    console.error("[algohunt:challenges] loadJudgeInput error:", e);
    rawTests = [];
  }

  const checker = normalizeChecker(safeJson(challenge.checker, {}));
  const rawMs = parseTimeLimitMs(challenge.timeLimit, 2000);
  const rawBytes = parseMemoryLimitBytes(challenge.memoryLimit, DEFAULT_MEM_BYTES);
  const timeLimitMs = Math.min(Math.max(rawMs, MIN_TIME_MS), MAX_TIME_MS);
  const memLimitBytes = Math.min(Math.max(rawBytes, MIN_MEM_BYTES), MAX_MEM_BYTES);

  return { tests: rawTests, checker, timeLimitMs, memLimitBytes };
}

/**
 * Determine the allowed languages for a challenge:
 * challenge.languages ∩ ARENA_LANGUAGES ∩ JUDGE_LANGUAGE.
 * If challenge.languages is null → all ARENA_LANGUAGES that are in JUDGE_LANGUAGE.
 */
export function allowedLanguages(challenge: AhChallenge): LanguageOption[] {
  const challengeLangs: string[] | null = challenge.languages
    ? safeJson<string[]>(challenge.languages, null)
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
    contentHtml = {
      statement: "",
      inputFormat: "",
      outputFormat: "",
      constraints: "",
      sampleExplanations: [],
    };
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
