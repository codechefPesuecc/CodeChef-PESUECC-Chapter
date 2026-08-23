import { NextResponse } from "next/server";
import { JUDGE_LANGUAGE, judgeExecute } from "@/lib/judge";
import {
  getChallengeBySlug,
  parseTimeLimitMs,
  parseMemoryLimitBytes,
} from "@/lib/challenges";
import { rateLimit, clientIp } from "@/server/rateLimit";
import { bodyTooLarge, tooLong, MAX_CODE_CHARS, MAX_STDIN_CHARS } from "@/server/limits";

export const dynamic = "force-dynamic";

const RUN_LIMIT = 40;
const RUN_WINDOW_MS = 60_000;

const MAX_RUN_MS = 10000;
const DEFAULT_RUN_MS = 2000;

const DEFAULT_MEM_BYTES = 256 * 1024 * 1024;
const MIN_MEM_BYTES = 32 * 1024 * 1024;
const MAX_MEM_BYTES = 512 * 1024 * 1024;

/**
 * Runs a submission in the Rust Judge Sandbox against the provided stdin and returns
 * the raw result. Backs the editor's "Run" button.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`run:ip:${clientIp(req)}`, RUN_LIMIT, RUN_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many runs — try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
        rateLimited: true,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const oversize = bodyTooLarge(req);
  if (oversize) return oversize;

  let body: {
    language?: string;
    code?: string;
    stdin?: string;
    slug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { language, code, stdin, slug } = body;
  if (!language || typeof code !== "string") {
    return NextResponse.json(
      { ok: false, error: "language and code are required." },
      { status: 400 },
    );
  }

  const codeTooLong = tooLong(code, MAX_CODE_CHARS, "Code");
  if (codeTooLong) return codeTooLong;
  if (typeof stdin === "string") {
    const stdinTooLong = tooLong(stdin, MAX_STDIN_CHARS, "Input");
    if (stdinTooLong) return stdinTooLong;
  }

  let runTimeoutMs = DEFAULT_RUN_MS;
  let memLimitBytes = DEFAULT_MEM_BYTES;
  if (typeof slug === "string") {
    const challenge = await getChallengeBySlug(slug);
    if (challenge) {
      runTimeoutMs = parseTimeLimitMs(challenge.timeLimit, DEFAULT_RUN_MS);
      memLimitBytes = parseMemoryLimitBytes(challenge.memoryLimit, DEFAULT_MEM_BYTES);
    }
  }
  runTimeoutMs = Math.min(Math.max(runTimeoutMs, 500), MAX_RUN_MS);
  memLimitBytes = Math.min(Math.max(memLimitBytes, MIN_MEM_BYTES), MAX_MEM_BYTES);

  const judgeLang = JUDGE_LANGUAGE[language.toLowerCase()];
  if (!judgeLang) {
    return NextResponse.json(
      { ok: false, error: `Unsupported language: ${language}.` },
      { status: 400 },
    );
  }

  try {
    const result = await judgeExecute({
      language: judgeLang,
      code,
      stdin: typeof stdin === "string" ? stdin : "",
      timeLimitMs: runTimeoutMs,
      memoryLimitBytes: memLimitBytes,
    });

    const firstTc = result.test_case_results?.[0];
    const compileFailed = result.verdict === "CompilationError";
    const timedOut = result.verdict === "TimeLimitExceeded" || firstTc?.verdict === "TimeLimitExceeded";

    return NextResponse.json({
      ok: true,
      language: judgeLang,
      version: "sandbox-native",
      compileFailed,
      compileStderr: compileFailed ? (firstTc?.stderr || result.compile_output || "Compilation Error") : "",
      stdout: firstTc?.stdout ?? "",
      stderr: firstTc?.stderr ?? "",
      exitCode: compileFailed ? 1 : 0,
      signal: timedOut ? "SIGKILL" : null,
      timedOut,
      timeLimitMs: runTimeoutMs,
      executionTimeMs: firstTc?.time_ms ?? result.total_time_ms,
      memoryBytes: firstTc?.memory_bytes ?? result.peak_memory_bytes,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Execution failed: ${String(error)}` },
      { status: 502 },
    );
  }
}