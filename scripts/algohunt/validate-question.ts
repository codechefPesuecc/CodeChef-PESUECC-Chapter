/**
 * AlgoHunt 2.0 — Question Validator CLI
 *
 * Implements §4.3 of Platform_06_Raj_Data_Import_and_QA.md:
 *   npx tsx scripts/algohunt/validate-question.ts <file.json> [--run]
 *
 * 1. Parse and run checkQuestion. Print errors and warnings with test indexes.
 * 2. With --run and JUDGE_URL + JUDGE_SECRET in the environment: run the reference
 *    (and the brute, if present) on Akiro against samples + tests via judgeTests.
 *    Print verdict, failing test and wall time. Also check every sample's expected
 *    output equals the reference's output.
 *
 * Exit code 0 only when there are no errors (and, with --run, the reference is AC within the limit).
 * Setters run it without --run (they don't get judge secrets). Only Raj runs --run.
 *
 * CONFIDENTIALITY: Real question JSONs never go into git. This tool reads them locally.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  checkQuestion,
  QuestionSchema,
  QUESTION_LIMITS,
} from "../../src/lib/algohunt/question-schema";
import { parseTimeLimitMs, parseMemoryLimitBytes } from "../../src/lib/challenges";

const FMT = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(msg: string) {
  console.log(msg);
}

function logError(msg: string) {
  console.error(`${FMT.red}✗ ERROR${FMT.reset}  ${msg}`);
}

function logWarn(msg: string) {
  console.warn(`${FMT.yellow}⚠ WARN${FMT.reset}   ${msg}`);
}

function logOk(msg: string) {
  console.log(`${FMT.green}✓ OK${FMT.reset}     ${msg}`);
}

function logInfo(msg: string) {
  console.log(`${FMT.cyan}ℹ INFO${FMT.reset}   ${msg}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flagRun = args.includes("--run");
  const flagQuiet = args.includes("--quiet");
  const flagTemplate = args.includes("--template");

  const files = args.filter((a) => !a.startsWith("--"));

  if (flagTemplate) {
    const templatePath = path.resolve(__dirname, "question-template.json");
    log(templatePath);
    process.exit(0);
  }

  if (files.length === 0) {
    log(`
${FMT.bold}AlgoHunt 2.0 — Question Validator${FMT.reset}

${FMT.dim}Usage:${FMT.reset}
  npx tsx scripts/algohunt/validate-question.ts <file.json> [--run]
  npm run algohunt:validate -- <file.json> [--run]

${FMT.dim}Flags:${FMT.reset}
  --run        Run reference & brute on Akiro against samples + tests (requires JUDGE_URL)
  --template   Print path to question-template.json
  --quiet      Suppress warnings
`);
    process.exit(0);
  }

  let exitCode = 0;

  for (const file of files) {
    const filePath = path.resolve(file);
    log(`\n${FMT.bold}── ${path.basename(filePath)} ──${FMT.reset}`);

    let rawText: string;
    try {
      rawText = fs.readFileSync(filePath, "utf-8");
    } catch {
      logError(`Cannot read file: ${filePath}`);
      exitCode = 1;
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch (err) {
      logError(`Invalid JSON: ${(err as Error).message}`);
      exitCode = 1;
      continue;
    }

    // 1. Run checkQuestion
    const result = checkQuestion(raw);

    for (const e of result.errors) {
      logError(String(e));
    }

    if (!flagQuiet) {
      for (const w of result.warnings) {
        logWarn(String(w));
      }
    }

    if (!result.ok) {
      logError(`Validation failed with ${result.errors.length} error(s).`);
      exitCode = 1;
      continue;
    }

    // Canonical SHA-256
    const canonical = JSON.stringify(raw, Object.keys(raw as object).sort());
    const sha256 = crypto.createHash("sha256").update(canonical).digest("hex");

    logOk(`Schema validation passed.`);
    if (result.stats) {
      logInfo(
        `Tests: ${result.stats.tests} | Samples: ${result.stats.samples} | ` +
          `Total chars: ${result.stats.totalChars.toLocaleString()} | ` +
          `Largest input: ${result.stats.largestInputChars.toLocaleString()} chars`,
      );
    }
    logInfo(`SHA-256: ${sha256}`);

    // 2. Akiro verification (--run)
    if (flagRun) {
      log(`\n${FMT.cyan}Running reference solution on Akiro judge...${FMT.reset}`);

      const parsed = QuestionSchema.safeParse(raw);
      if (!parsed.success) {
        logError("Cannot run on judge: question schema parse failed.");
        exitCode = 1;
        continue;
      }

      const q = parsed.data;
      const judgeUrl = process.env.JUDGE_URL;

      if (!judgeUrl) {
        logWarn("JUDGE_URL is not set in environment. Defaulting to judge client configuration.");
      }

      try {
        const { judgeTests } = await import("../../src/server/judge");

        const timeLimitMs = parseTimeLimitMs(q.timeLimit);
        const memLimitBytes = parseMemoryLimitBytes(q.memoryLimit, 256 * 1024 * 1024);

        // Run reference against samples + tests
        const allTests = [
          ...q.samples.map((s) => ({ input: s.input, output: s.output })),
          ...q.tests,
        ];

        const tStart = performance.now();
        const refResult = await judgeTests({
          tests: allTests,
          checker: q.checker ?? { type: "token" },
          language: q.referenceSolution.language,
          code: q.referenceSolution.code,
          timeLimitMs,
          memLimitBytes,
        });
        const wallMs = Math.round(performance.now() - tStart);

        if (refResult.verdict === "AC") {
          logOk(
            `Reference solution: ${FMT.green}AC${FMT.reset} ` +
              `(${refResult.passed}/${refResult.total} tests passed) in ${wallMs}ms`,
          );

          if (wallMs > QUESTION_LIMITS.maxReferenceTotalMs) {
            logError(
              `Reference total runtime (${wallMs}ms) exceeds maxReferenceTotalMs (${QUESTION_LIMITS.maxReferenceTotalMs}ms).`,
            );
            exitCode = 1;
          }
        } else {
          logError(
            `Reference solution: ${FMT.red}${refResult.verdict}${FMT.reset} ` +
              `(${refResult.passed}/${refResult.total} passed` +
              (refResult.failedOn != null ? `, failing test index: ${refResult.failedOn}` : "") +
              `) in ${wallMs}ms`,
          );
          if (refResult.detail) {
            logInfo(`Judge detail: ${refResult.detail}`);
          }
          exitCode = 1;
        }

        // Check every sample's expected output equals reference's output
        log(`\n${FMT.cyan}Checking sample expected outputs against reference...${FMT.reset}`);
        const sampleCheck = await judgeTests({
          tests: q.samples.map((s) => ({ input: s.input, output: s.output })),
          checker: q.checker ?? { type: "token" },
          language: q.referenceSolution.language,
          code: q.referenceSolution.code,
          timeLimitMs,
          memLimitBytes,
        });

        if (sampleCheck.verdict === "AC") {
          logOk(`Sample verification: ${FMT.green}AC${FMT.reset} (all sample outputs match reference).`);
        } else {
          logError(
            `Sample verification: ${FMT.red}${sampleCheck.verdict}${FMT.reset} — sample output mismatch!`,
          );
          exitCode = 1;
        }

        // Run brute solution if present
        if (q.bruteSolution) {
          log(`\n${FMT.cyan}Running brute solution on Akiro judge...${FMT.reset}`);
          const bStart = performance.now();
          const bruteResult = await judgeTests({
            tests: allTests,
            checker: q.checker ?? { type: "token" },
            language: q.bruteSolution.language,
            code: q.bruteSolution.code,
            timeLimitMs,
            memLimitBytes,
          });
          const bruteWallMs = Math.round(performance.now() - bStart);

          if (bruteResult.verdict === "AC") {
            logOk(
              `Brute solution: ${FMT.green}AC${FMT.reset} ` +
                `(${bruteResult.passed}/${bruteResult.total} passed) in ${bruteWallMs}ms`,
            );
          } else if (bruteResult.verdict === "TLE") {
            logWarn(
              `Brute solution: TLE on large tests (expected for brute-force) in ${bruteWallMs}ms`,
            );
          } else {
            logWarn(
              `Brute solution: ${bruteResult.verdict} — brute and reference disagree! ` +
                `(${bruteResult.passed}/${bruteResult.total} passed) in ${bruteWallMs}ms`,
            );
          }
        }
      } catch (err) {
        logError(`Akiro judge connection error: ${(err as Error).message}`);
        logInfo("Check JUDGE_URL or start judge locally: npm run judge:up");
        exitCode = 1;
      }
    }
  }

  log("");
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Fatal validator error:", err);
  process.exit(1);
});
