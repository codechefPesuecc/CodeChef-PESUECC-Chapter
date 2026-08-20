import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrParticipants, monstrProblems, monstrContests } from "@/server/db/schema";
import { PISTON_LANGUAGE, pistonExecute, pistonRuntimes } from "@/lib/piston";
import { rateLimit } from "@/server/rateLimit";
import { bodyTooLarge, tooLong, MAX_CODE_CHARS, MAX_STDIN_CHARS } from "@/server/limits";
import { parseTimeLimitMs, parseMemoryLimitBytes } from "@/lib/challenges";

export const dynamic = "force-dynamic";

const RUN_LIMIT = 40;
const RUN_WINDOW_MS = 60_000;
const MAX_RUN_MS = 10000;
const DEFAULT_MEM_BYTES = 256 * 1024 * 1024;
const MIN_MEM_BYTES = 32 * 1024 * 1024;
const MAX_MEM_BYTES = 512 * 1024 * 1024;

const FILE_NAME: Record<string, string> = {
  cpp: "main.cpp",
  c: "main.c",
  python: "main.py",
  java: "Main.java",
  csharp: "main.cs",
  javascript: "main.js",
  go: "main.go",
  rust: "main.rs",
  zig: "main.zig",
};

/**
 * Run code against sample input. Requires authentication and participation.
 * Allowed after contest ends (run is not graded, only test execution).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Require authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  // Rate limit per user
  const userLimit = await rateLimit(`monstr:run:user:${user.id}`, RUN_LIMIT, RUN_WINDOW_MS);
  if (!userLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many runs — try again in ${Math.ceil(userLimit.retryAfterMs / 1000)}s.`,
        rateLimited: true,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(userLimit.retryAfterMs / 1000)) } },
    );
  }

  const oversize = bodyTooLarge(req);
  if (oversize) return oversize;

  let body: {
    problemId?: string;
    language?: string;
    code?: string;
    stdin?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { problemId, language, code, stdin } = body;
  if (!language || typeof code !== "string" || !problemId) {
    return NextResponse.json(
      { ok: false, error: "problemId, language, and code are required." },
      { status: 400 },
    );
  }

  const codeTooLong = tooLong(code, MAX_CODE_CHARS, "Code");
  if (codeTooLong) return codeTooLong;
  if (typeof stdin === "string") {
    const stdinTooLong = tooLong(stdin, MAX_STDIN_CHARS, "Input");
    if (stdinTooLong) return stdinTooLong;
  }

  try {
    const db = getDb();

    // Verify participant is joined to contest
    const participantRows = await db
      .select()
      .from(monstrParticipants)
      .where(
        and(
          eq(monstrParticipants.contestId, id),
          eq(monstrParticipants.userId, user.id),
        ),
      )
      .limit(1);

    if (!participantRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Not joined to contest." },
        { status: 403 },
      );
    }

    // Get contest to check allowed languages
    const contestRows = await db
      .select()
      .from(monstrContests)
      .where(eq(monstrContests.id, id))
      .limit(1);

    if (!contestRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Contest not found." },
        { status: 404 },
      );
    }

    const contest = contestRows[0];
    const allowedLanguages = JSON.parse(contest.allowedLanguages) as string[];

    // Validate language is in allowed list for this contest
    if (!allowedLanguages.includes(language)) {
      return NextResponse.json(
        { ok: false, error: `Language "${language}" is not allowed for this contest.` },
        { status: 400 },
      );
    }

    // Get problem
    const problemRows = await db
      .select()
      .from(monstrProblems)
      .where(
        and(
          eq(monstrProblems.id, problemId),
          eq(monstrProblems.contestId, id),
        ),
      )
      .limit(1);

    if (!problemRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Problem not found." },
        { status: 404 },
      );
    }

    const problem = problemRows[0];
    const pistonLang = PISTON_LANGUAGE[language];
    if (!pistonLang) {
      return NextResponse.json(
        { ok: false, error: `Unsupported language: ${language}.` },
        { status: 400 },
      );
    }

    // Get runtimes and find version
    let version: string;
    try {
      const runtimes = await pistonRuntimes();
      const runtime = runtimes.find(
        (r) => r.language === pistonLang || r.aliases?.includes(pistonLang),
      );
      if (!runtime) {
        return NextResponse.json(
          { ok: false, error: `No ${pistonLang} runtime installed.` },
          { status: 503 },
        );
      }
      version = runtime.version;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Judge (Piston) is unreachable." },
        { status: 503 },
      );
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
    const fileName = FILE_NAME[language] ?? "main.txt";

    // Execute
    const result = await pistonExecute({
      language: pistonLang,
      version,
      files: [{ name: fileName, content: code }],
      stdin: typeof stdin === "string" ? stdin : "",
      runTimeoutMs: timeLimitMs,
      runMemoryLimitBytes: memLimitBytes,
    });

    const compileFailed = !!result.compile && result.compile.code !== 0;
    const timedOut = result.run.signal === "SIGKILL";

    return NextResponse.json({
      ok: true,
      language: pistonLang,
      version,
      compileFailed,
      compileStderr: result.compile?.stderr ?? "",
      stdout: result.run.stdout,
      stderr: result.run.stderr,
      exitCode: result.run.code,
      signal: result.run.signal,
      timedOut,
      timeLimitMs,
    });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/run] execution error:", error);
    return NextResponse.json(
      { ok: false, error: "Execution failed. Please try again." },
      { status: 502 },
    );
  }
}
