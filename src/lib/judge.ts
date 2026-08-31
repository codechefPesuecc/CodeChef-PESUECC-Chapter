/**
 * Client for the high-performance self-hosted Rust Judge Sandbox.
 * Reached at JUDGE_URL (defaults to http://localhost:8080 or remote Azure VM).
 */
const JUDGE_URL = process.env.JUDGE_URL ?? "http://localhost:8080";
const JUDGE_SECRET = process.env.JUDGE_SECRET || process.env.JUDGE_API_SECRET;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUDGE_SECRET) {
    headers["X-Judge-Secret"] = JUDGE_SECRET;
    headers["Authorization"] = `Bearer ${JUDGE_SECRET}`;
  }
  return headers;
}

/** Maps problem language identifiers to Judge Sandbox language names. */
export const JUDGE_LANGUAGE: Record<string, string> = {
  cpp: "cpp",
  "c++": "cpp",
  c: "c",
  python: "python",
  python3: "python",
  py: "python",
  pypy3: "pypy",
  pypy: "pypy",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  sql: "sql",
  java: "java",
};

export interface RawTestCaseResult {
  test_case_index: number;
  status: "Accepted" | "WrongAnswer" | "TimeLimitExceeded" | "MemoryLimitExceeded" | "RuntimeError" | "CompilationError";
  cpu_time_ms: number;
  memory_kb: number;
  stdout: number[] | string;
  stderr: number[] | string;
}

export interface RawJobResult {
  job_id: string;
  verdict: "Accepted" | "WrongAnswer" | "TimeLimitExceeded" | "MemoryLimitExceeded" | "RuntimeError" | "CompilationError";
  total_cpu_time_ms: number;
  peak_memory_kb: number;
  compile_output?: string | null;
  test_results: RawTestCaseResult[];
}

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
  compile_output?: string | null;
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

export function decodeOutput(val: number[] | string | undefined | null): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return Buffer.from(val).toString("utf-8");
  }
  return String(val);
}

export async function judgeHealth(): Promise<JudgeHealth> {
  const res = await fetch(`${JUDGE_URL}/health`, {
    headers: getHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
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
    : [{ input: params.stdin ?? "", expected_output: undefined }];

  const payload = {
    job_id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    language: judgeLang,
    source_code: params.code,
    time_limit_ms: params.timeLimitMs ?? 2000,
    memory_limit_bytes: params.memoryLimitBytes ?? 268435456,
    test_cases: testCases,
  };

  const MAX_RETRIES = 3;
  let attempt = 0;
  let res: Response | null = null;
  let lastErrorText = "";

  while (attempt <= MAX_RETRIES) {
    res = await fetch(`${JUDGE_URL}/api/v1/submit`, {
      method: "POST",
      headers: getHeaders(),
      cache: "no-store",
      // Cap each attempt so a hung/slow judge can't pin the Worker subrequest
      // indefinitely (a runaway would stall requests and burn the CPU budget).
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      break;
    }

    if (res.status === 503 && attempt < MAX_RETRIES) {
      let retryAfterMs = 2000;
      try {
        const bodyJson = (await res.clone().json()) as { retry_after_secs?: number };
        if (bodyJson?.retry_after_secs && typeof bodyJson.retry_after_secs === "number") {
          retryAfterMs = bodyJson.retry_after_secs * 1000;
        }
      } catch {
        // Fallback to backoff
      }
      const jitter = Math.floor(Math.random() * 500);
      const backoffMs = Math.min(6000, retryAfterMs + attempt * 1000 + jitter);
      await new Promise((r) => setTimeout(r, backoffMs));
      attempt++;
      continue;
    }

    lastErrorText = await res.text().catch(() => "");
    break;
  }

  if (!res || !res.ok) {
    if (res?.status === 503) {
      throw new Error(
        "Judge server is currently busy handling heavy contest submissions. Please retry in a few seconds."
      );
    }
    throw new Error(`Judge execution failed (HTTP ${res?.status ?? 500}): ${lastErrorText}`);
  }

  const raw = (await res.json()) as RawJobResult;
  
  const formattedTestCases: JudgeTestCaseResult[] = (raw.test_results || []).map((t) => ({
    test_case_index: t.test_case_index,
    verdict: t.status,
    time_ms: t.cpu_time_ms,
    memory_bytes: t.memory_kb * 1024,
    stdout: decodeOutput(t.stdout),
    stderr: decodeOutput(t.stderr),
  }));

  return {
    job_id: raw.job_id,
    verdict: raw.verdict,
    total_time_ms: raw.total_cpu_time_ms,
    peak_memory_bytes: raw.peak_memory_kb * 1024,
    compile_output: raw.compile_output,
    test_case_results: formattedTestCases,
  };
}