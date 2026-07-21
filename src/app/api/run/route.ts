import { NextResponse } from "next/server";
import { PISTON_LANGUAGE, pistonExecute, pistonRuntimes } from "@/lib/piston";
import { getChallengeBySlug, parseTimeLimitMs } from "@/lib/challenges";

export const dynamic = "force-dynamic";

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

// Must not exceed PISTON_RUN_TIMEOUT on the container (see docker-compose.yml).
const MAX_RUN_MS = 10000;
const DEFAULT_RUN_MS = 2000;

/**
 * Runs a submission in the Piston sandbox against the provided stdin and returns
 * the raw result. This backs the editor's "Run" button (test against the sample
 * or custom input). The browser calls this route; only the server talks to
 * Piston. Grading against hidden tests will live in /api/submit.
 */
export async function POST(req: Request) {
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

  // Resolve the run-time limit from the problem itself (server-side, so it
  // can't be spoofed by the client), clamped to what the sandbox allows.
  let runTimeoutMs = DEFAULT_RUN_MS;
  if (typeof slug === "string") {
    const challenge = getChallengeBySlug(slug);
    if (challenge) {
      runTimeoutMs = parseTimeLimitMs(challenge.meta.timeLimit, DEFAULT_RUN_MS);
    }
  }
  runTimeoutMs = Math.min(Math.max(runTimeoutMs, 500), MAX_RUN_MS);

  const pistonLang = PISTON_LANGUAGE[language];
  if (!pistonLang) {
    return NextResponse.json(
      { ok: false, error: `Unsupported language: ${language}.` },
      { status: 400 },
    );
  }

  let version: string;
  try {
    const runtimes = await pistonRuntimes();
    const runtime = runtimes.find(
      (r) => r.language === pistonLang || r.aliases?.includes(pistonLang),
    );
    if (!runtime) {
      return NextResponse.json(
        {
          ok: false,
          error: `No ${pistonLang} runtime installed. Run scripts/install-runtimes.sh.`,
        },
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

  try {
    const result = await pistonExecute({
      language: pistonLang,
      version,
      files: [{ name: FILE_NAME[language] ?? "main.txt", content: code }],
      stdin: typeof stdin === "string" ? stdin : "",
      runTimeoutMs,
    });

    const compileFailed = !!result.compile && result.compile.code !== 0;
    // Piston kills a run that exceeds its timeout with SIGKILL.
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
      timeLimitMs: runTimeoutMs,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Execution failed: ${String(error)}` },
      { status: 502 },
    );
  }
}
