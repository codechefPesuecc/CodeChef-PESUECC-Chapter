/**
 * POST /api/algohunt/run
 * Run code on custom input against the current question's limits.
 * Never uses hidden tests. Never creates a submission row.
 */
import { z } from "zod";
import { requireTeam } from "@/server/algohunt/teamSession";
import { getTeamProgress, assertTeamCanPlay } from "@/server/algohunt/access";
import { getStageChallenge, allowedLanguages, loadJudgeInput } from "@/server/algohunt/challenges";
import { ok, fail, parseBody } from "@/server/algohunt/http";
import { enforceRateLimits, clientIp } from "@/server/rateLimit";
import { MAX_CODE_CHARS, MAX_STDIN_CHARS } from "@/server/limits";
import { judgeExecute, JUDGE_LANGUAGE } from "@/lib/judge";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const runSchema = z
  .object({
    language: z.string().max(20),
    code: z.string().min(1).max(MAX_CODE_CHARS),
    stdin: z.string().max(MAX_STDIN_CHARS).default(""),
  })
  .strict();

export async function POST(req: Request): Promise<NextResponse> {
  const ctx = await requireTeam();
  if (!("team" in ctx)) return ctx as NextResponse;

  const { team } = ctx;
  const ip = clientIp(req);

  // Rate limit (contract §15)
  const rateLimited = await enforceRateLimits([
    [`ah:run:team:${team.id}`, 20, 60_000],
    [`ah:run:ip:${ip}`, 60, 60_000],
  ]);
  if (rateLimited) return rateLimited;

  // Parse body
  const parsed = await parseBody(req, runSchema);
  if (!parsed.ok) return parsed.response;
  const { language, code, stdin } = parsed.data;

  // Play check (no CODES_DISABLED for run)
  const block = assertTeamCanPlay(ctx, "run");
  if (block) {
    return fail(block.code, block.message);
  }

  // Get current question
  const progress = await getTeamProgress(ctx);
  const cur = progress.current;
  if (!cur) {
    return fail("EVENT_NOT_LIVE");
  }

  // Language must be allowed for this challenge
  const sc = await getStageChallenge(cur.stage.id);
  if (!sc) {
    return fail("INTERNAL", "Challenge data not found.");
  }

  const allowed = allowedLanguages(sc.challenge);
  const isAllowed = allowed.some((l) => l.id === language);
  const judgeLang = JUDGE_LANGUAGE[language.toLowerCase()];
  if (!isAllowed || !judgeLang) {
    return fail("UNSUPPORTED_LANGUAGE");
  }

  // Load limits from the current challenge (not defaults)
  const judgeInput = await loadJudgeInput(sc.challenge);

  try {
    const result = await judgeExecute({
      language: judgeLang,
      code,
      stdin,
      timeLimitMs: judgeInput.timeLimitMs,
      memoryLimitBytes: judgeInput.memLimitBytes,
    });

    const firstTc = result.test_case_results?.[0];
    const compileFailed = result.verdict === "CompilationError";
    const timedOut =
      result.verdict === "TimeLimitExceeded" ||
      firstTc?.verdict === "TimeLimitExceeded";

    return ok({
      stdout: firstTc?.stdout ?? "",
      stderr: firstTc?.stderr ?? "",
      compileFailed,
      compileStderr: compileFailed
        ? (firstTc?.stderr || result.compile_output || "Compilation failed.")
        : "",
      timedOut,
      executionTimeMs: firstTc?.time_ms ?? result.total_time_ms,
      memoryBytes: firstTc?.memory_bytes ?? result.peak_memory_bytes,
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[algohunt:run] Judge offline in dev mode; simulating run output.");
      const nums = stdin.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n));
      const simulatedOutput = nums.length >= 2 ? `${nums[0] + nums[1]}\n` : (stdin ? `${stdin.trim()}\n` : "");
      return ok({
        stdout: simulatedOutput,
        stderr: "",
        compileFailed: false,
        compileStderr: "",
        timedOut: false,
        executionTimeMs: 14,
        memoryBytes: 1048576,
      });
    }
    console.error("[algohunt:run]", e);
    return fail("JUDGE_UNAVAILABLE");
  }
}
