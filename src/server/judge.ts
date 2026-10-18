import {
  getChallengeBySlug,
  parseTimeLimitMs,
  parseMemoryLimitBytes,
  type Checker,
  type TestCase,
} from "@/lib/challenges";
import { JUDGE_LANGUAGE, judgeExecute } from "@/lib/judge";
import type { MonstrProblem } from "@/server/db/schema";

/**
 * Server-side judge: compiles and evaluates a submission in the Rust Judge Sandbox
 * against hidden test cases. Hidden test data is never returned to the client.
 */

export type Verdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "NO_TESTS" | "ERR";

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  /** 1-based index of the failing test (absent for AC / NO_TESTS). */
  failedOn?: number;
  /** Compiler output for CE, or the program's stderr for RE. Safe to show. */
  detail?: string;
  message?: string;
}

const MAX_RUN_MS = 10000;
const DEFAULT_MEM_BYTES = 256 * 1024 * 1024;
const MIN_MEM_BYTES = 32 * 1024 * 1024;
const MAX_MEM_BYTES = 512 * 1024 * 1024;

/** Compares program output to the expected output per the problem's checker. */
function outputMatches(got: string, expected: string, checker: Checker): boolean {
  const g = got.replace(/\r\n/g, "\n");
  const e = expected.replace(/\r\n/g, "\n");

  if (checker.type === "exact") {
    return g.replace(/\n+$/, "") === e.replace(/\n+$/, "");
  }

  const gt = g.trim().split(/\s+/).filter(Boolean);
  const et = e.trim().split(/\s+/).filter(Boolean);
  if (gt.length !== et.length) return false;

  if (checker.type === "float") {
    const eps = checker.epsilon ?? 1e-6;
    return gt.every((tok, i) => {
      const a = Number(tok);
      const b = Number(et[i]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
      }
      return tok === et[i];
    });
  }

  // token (default): whitespace-insensitive exact token match
  return gt.every((tok, i) => tok === et[i]);
}

/**
 * Akiro refuses request bodies over 2 MB (axum's default), so tests are sent in batches well
 * under that. Each batch is one judge request; the next batch only runs if this one passed.
 */
export const MAX_JUDGE_BATCH_BYTES = 1_500_000;

/** Split tests into judge requests of at most MAX_JUDGE_BATCH_BYTES of JSON each (one test can be alone). Pure. */
export function batchTests(tests: readonly TestCase[], maxBytes = MAX_JUDGE_BATCH_BYTES): TestCase[][] {
  const batches: TestCase[][] = [];
  let current: TestCase[] = [];
  let bytes = 0;
  for (const test of tests) {
    // The JSON form is what goes over the wire (newlines become two characters).
    const size = Buffer.byteLength(JSON.stringify({ input: test.input, expected_output: test.output }));
    if (current.length > 0 && bytes + size > maxBytes) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(test);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Core judging logic: runs code against test cases in Rust Sandbox and returns verdict.
 */
export async function judgeTests(params: {
  tests: TestCase[];
  checker: Checker;
  language: string;
  code: string;
  timeLimitMs: number;
  memLimitBytes: number;
}): Promise<JudgeResult> {
  const { tests, checker, language, code, timeLimitMs, memLimitBytes } = params;

  const judgeLang = JUDGE_LANGUAGE[language.toLowerCase()];
  if (!judgeLang) {
    return { verdict: "ERR", passed: 0, total: tests.length, message: `Unsupported language: ${language}.` };
  }

  const actualTimeLimit = Math.min(Math.max(timeLimitMs, 500), MAX_RUN_MS);
  const actualMemLimit = Math.min(Math.max(memLimitBytes, MIN_MEM_BYTES), MAX_MEM_BYTES);

  let passed = 0;
  try {
    for (const batch of batchTests(tests)) {
      const offset = passed;
      const result = await judgeExecute({
        language: judgeLang,
        code,
        testCases: batch.map((t) => ({ input: t.input, expected_output: t.output })),
        timeLimitMs: actualTimeLimit,
        memoryLimitBytes: actualMemLimit,
      });

      if (result.verdict === "CompilationError") {
        const firstError = result.test_case_results?.[0]?.stderr || "Compilation failed.";
        return { verdict: "CE", passed: 0, total: tests.length, detail: firstError };
      }

      for (let i = 0; i < batch.length; i++) {
        const tc = result.test_case_results?.[i];
        const failedOn = offset + i + 1;
        if (!tc) {
          // Akiro stops at the failing test and reports why only in the overall verdict.
          const verdict = result.verdict === "TimeLimitExceeded" ? "TLE"
            : result.verdict === "MemoryLimitExceeded" ? "MLE"
              : result.verdict === "RuntimeError" ? "RE" : "WA";
          return { verdict, passed, total: tests.length, failedOn };
        }
        if (tc.verdict === "TimeLimitExceeded") {
          return { verdict: "TLE", passed, total: tests.length, failedOn };
        }
        if (tc.verdict === "MemoryLimitExceeded") {
          return { verdict: "MLE", passed, total: tests.length, failedOn, detail: tc.stderr };
        }
        if (tc.verdict === "RuntimeError") {
          return { verdict: "RE", passed, total: tests.length, failedOn, detail: tc.stderr };
        }
        if (!outputMatches(tc.stdout, batch[i].output, checker)) {
          return { verdict: "WA", passed, total: tests.length, failedOn };
        }
        passed++;
      }
    }
    return { verdict: "AC", passed, total: tests.length };
  } catch (error) {
    return { verdict: "ERR", passed: 0, total: tests.length, message: String(error) };
  }
}

/**
 * Judge a CP Arena challenge submission against hidden tests.
 */
export async function judge(params: {
  slug: string;
  language: string;
  code: string;
}): Promise<JudgeResult> {
  const { slug, language, code } = params;

  const judgeLang = JUDGE_LANGUAGE[language.toLowerCase()];
  if (!judgeLang) {
    return { verdict: "ERR", passed: 0, total: 0, message: `Unsupported language: ${language}.` };
  }

  const challenge = await getChallengeBySlug(slug);
  const tests = challenge?.tests ?? [];
  if (tests.length === 0) {
    return { verdict: "NO_TESTS", passed: 0, total: 0, message: "No hidden tests for this problem yet." };
  }

  const checker = challenge?.checker ?? { type: "token" as const };
  const timeLimitMs = Math.min(
    Math.max(parseTimeLimitMs(challenge?.timeLimit, 2000), 500),
    MAX_RUN_MS,
  );
  const memLimitBytes = Math.min(
    Math.max(
      parseMemoryLimitBytes(challenge?.memoryLimit, DEFAULT_MEM_BYTES),
      MIN_MEM_BYTES,
    ),
    MAX_MEM_BYTES,
  );

  return judgeTests({
    tests,
    checker,
    language,
    code,
    timeLimitMs,
    memLimitBytes,
  });
}

/**
 * Judge a Monstr contest problem submission.
 */
export async function monstrJudge(params: {
  problem: MonstrProblem;
  language: string;
  code: string;
}): Promise<JudgeResult> {
  const { problem, language, code } = params;

  const judgeLang = JUDGE_LANGUAGE[language.toLowerCase()];
  if (!judgeLang) {
    return { verdict: "ERR", passed: 0, total: 0, message: `Unsupported language: ${language}.` };
  }

  let tests: TestCase[] = [];
  try {
    tests = JSON.parse(problem.tests || "[]");
  } catch {
    return { verdict: "ERR", passed: 0, total: 0, message: "Invalid test data." };
  }

  if (tests.length === 0) {
    return { verdict: "NO_TESTS", passed: 0, total: 0, message: "No tests for this problem." };
  }

  let checker: Checker = { type: "token" };
  try {
    checker = JSON.parse(problem.checker || '{"type":"token"}');
  } catch {
    checker = { type: "token" };
  }

  const timeLimitMs = Math.min(
    Math.max(parseTimeLimitMs(problem.timeLimit ?? undefined, 2000), 500),
    MAX_RUN_MS,
  );
  const memLimitBytes = Math.min(
    Math.max(
      parseMemoryLimitBytes(problem.memoryLimit ?? undefined, DEFAULT_MEM_BYTES),
      MIN_MEM_BYTES,
    ),
    MAX_MEM_BYTES,
  );

  return judgeTests({
    tests,
    checker,
    language,
    code,
    timeLimitMs,
    memLimitBytes,
  });
}