/**
 * Client for the high-performance self-hosted Rust Judge Sandbox.
 * Reached at JUDGE_URL (defaults to http://localhost:8080).
 */
import os from "node:os";

const JUDGE_URL = process.env.JUDGE_URL ?? "http://localhost:8080";

const MAX_CONCURRENT_JOBS = Math.max(
  1,
  Number(process.env.JUDGE_CONCURRENCY) || (os.cpus?.().length ?? 4) - 1,
);
let activeJobs = 0;
const jobQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_JOBS) {
    activeJobs++;
    return Promise.resolve();
  }
  return new Promise((resolve) => jobQueue.push(resolve));
}

function releaseSlot(): void {
  const next = jobQueue.shift();
  if (next) next();
  else activeJobs--;
}

export function judgeQueueStats() {
  return { active: activeJobs, queued: jobQueue.length, max: MAX_CONCURRENT_JOBS };
}

/** Maps problem language identifiers to Judge Sandbox language names. */
export const JUDGE_LANGUAGE: Record<string, string> = {
  cpp: "cpp",
  "c++": "cpp",
  c: "c",
  python: "python",
  python3: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  sql: "sql",
  java: "java",
};

export interface JudgeTestCaseResult {
  test_case_index: number;
  verdict: "Accepted" | "WrongAnswer" | "TimeLimitExceeded" | "MemoryLimitExceeded" | "RuntimeError" | "CompilationError";
  time_ms: number;
  memory_bytes: number;
  stdout: string;
  stderr: string;
}

export interface JudgeExecutionResult {
  job_id: string;
  verdict: "Accepted" | "WrongAnswer" | "TimeLimitExceeded" | "MemoryLimitExceeded" | "RuntimeError" | "CompilationError";
  total_time_ms: number;
  peak_memory_bytes: number;
  test_case_results: JudgeTestCaseResult[];
  error?: string;
}

export interface JudgeHealth {
  total_workers: number;
  idle_workers: number;
  busy_workers: number;
  queued_jobs: number;
  uptime_secs: number;
}

export async function judgeHealth(): Promise<JudgeHealth> {
  const res = await fetch(`${JUDGE_URL}/health`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Judge health check failed: HTTP ${res.status}`);
  return (await res.json()) as JudgeHealth;
}

export async function judgeExecute(params: {
  language: string;
  code: string;
  stdin?: string;
  testCases?: { input: string; expected_output?: string }[];
  timeLimitMs?: number;
  memoryLimitBytes?: number;
}): Promise<JudgeExecutionResult> {
  const judgeLang = JUDGE_LANGUAGE[params.language.toLowerCase()];
  if (!judgeLang) {
    throw new Error(`Unsupported language: ${params.language}`);
  }

  const testCases = params.testCases && params.testCases.length > 0
    ? params.testCases
    : [{ input: params.stdin ?? "", expected_output: "" }];

  await acquireSlot();
  try {
    const payload = {
      job_id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      language: judgeLang,
      source_code: params.code,
      time_limit_ms: params.timeLimitMs ?? 2000,
      memory_limit_bytes: params.memoryLimitBytes ?? 268435456,
      test_cases: testCases,
    };

    const res = await fetch(`${JUDGE_URL}/api/v1/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Judge execution failed (HTTP ${res.status}): ${detail}`);
    }

    return (await res.json()) as JudgeExecutionResult;
  } finally {
    releaseSlot();
  }
}