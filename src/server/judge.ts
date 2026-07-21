import {
  getChallengeBySlug,
  parseTimeLimitMs,
  type Checker,
} from "@/lib/challenges";
import { PISTON_LANGUAGE, pistonExecute, pistonRuntimes } from "@/lib/piston";

/**
 * Server-side judge: compiles and runs a submission in Piston against every
 * hidden test for a challenge, stopping at the first failure. Hidden test data
 * is never returned to the client — only the verdict and which test index
 * failed.
 */

export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE" | "NO_TESTS" | "ERR";

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

const MAX_RUN_MS = 10000;

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

export async function judge(params: {
  slug: string;
  language: string;
  code: string;
}): Promise<JudgeResult> {
  const { slug, language, code } = params;

  const pistonLang = PISTON_LANGUAGE[language];
  if (!pistonLang) {
    return { verdict: "ERR", passed: 0, total: 0, message: `Unsupported language: ${language}.` };
  }

  const challenge = getChallengeBySlug(slug);
  const tests = challenge?.tests ?? [];
  if (tests.length === 0) {
    return { verdict: "NO_TESTS", passed: 0, total: 0, message: "No hidden tests for this problem yet." };
  }

  let version: string;
  try {
    const runtimes = await pistonRuntimes();
    const runtime = runtimes.find(
      (r) => r.language === pistonLang || r.aliases?.includes(pistonLang),
    );
    if (!runtime) {
      return { verdict: "ERR", passed: 0, total: tests.length, message: `No ${pistonLang} runtime installed.` };
    }
    version = runtime.version;
  } catch {
    return { verdict: "ERR", passed: 0, total: tests.length, message: "Judge (Piston) is unreachable." };
  }

  const checker = challenge?.checker ?? { type: "token" as const };
  const timeLimitMs = Math.min(
    Math.max(parseTimeLimitMs(challenge?.timeLimit, 2000), 500),
    MAX_RUN_MS,
  );
  const fileName = FILE_NAME[language] ?? "main.txt";

  let passed = 0;
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    let result;
    try {
      result = await pistonExecute({
        language: pistonLang,
        version,
        files: [{ name: fileName, content: code }],
        stdin: test.input,
        runTimeoutMs: timeLimitMs,
      });
    } catch (error) {
      return { verdict: "ERR", passed, total: tests.length, message: String(error) };
    }

    if (result.compile && result.compile.code !== 0) {
      return { verdict: "CE", passed, total: tests.length, detail: result.compile.stderr };
    }
    if (result.run.signal === "SIGKILL") {
      return { verdict: "TLE", passed, total: tests.length, failedOn: i + 1 };
    }
    if (result.run.code !== 0) {
      return { verdict: "RE", passed, total: tests.length, failedOn: i + 1, detail: result.run.stderr };
    }
    if (!outputMatches(result.run.stdout, test.output, checker)) {
      return { verdict: "WA", passed, total: tests.length, failedOn: i + 1 };
    }
    passed++;
  }

  return { verdict: "AC", passed, total: tests.length };
}
