import fs from "node:fs";
import path from "node:path";
import { getChallengeBySlug, parseTimeLimitMs } from "@/lib/challenges";
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

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

function loadTests(slug: string): TestCase[] {
  const dir = path.join(process.cwd(), "tests", slug);
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".in"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((inFile) => {
      const base = inFile.replace(/\.in$/, "");
      const outFile = path.join(dir, `${base}.out`);
      return {
        name: base,
        input: fs.readFileSync(path.join(dir, inFile), "utf8"),
        expected: fs.existsSync(outFile)
          ? fs.readFileSync(outFile, "utf8")
          : "",
      };
    });
}

/** Trailing-whitespace-insensitive output comparison. */
function normalize(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "");
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

  const tests = loadTests(slug);
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

  const challenge = getChallengeBySlug(slug);
  const timeLimitMs = Math.min(
    Math.max(parseTimeLimitMs(challenge?.meta.timeLimit, 2000), 500),
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
    if (normalize(result.run.stdout) !== normalize(test.expected)) {
      return { verdict: "WA", passed, total: tests.length, failedOn: i + 1 };
    }
    passed++;
  }

  return { verdict: "AC", passed, total: tests.length };
}
