import { z } from "zod";
import crypto from "node:crypto";
import { ChallengeSchema } from "@/lib/challenge-schema";
import { parseTimeLimitMs } from "@/lib/challenges";
import { JUDGE_LANGUAGE } from "@/lib/judge";

/**
 * AlgoHunt 2.0 Question Schema (v1).
 *
 * Implements §4.1 of Platform_06_Raj_Data_Import_and_QA.md.
 *
 * Extends ChallengeSchema (Problem of the Day authoring schema) without copying it.
 * Strictly checks limits for test cases, size, runtime, memory, solution languages,
 * and outputs human-readable errors and warnings via checkQuestion().
 *
 * CONFIDENTIALITY: Real question JSONs never go into git, issues, PR descriptions,
 * screenshots or group chats. Only the test content in test-content.ts is committed.
 */

export const QUESTION_LIMITS = {
  minTests: 5,
  maxTests: 60,
  maxSamples: 5,
  maxInputChars: 1_500_000,
  maxOutputChars: 400_000,
  maxTotalChars: 12_000_000,
  minTimeMs: 500,
  maxTimeMs: 5_000,
  minMemMb: 32,
  maxMemMb: 512,
  maxReferenceTotalMs: 10_000, // enforced at verification time (Akiro client timeout is 30 s)
} as const;

/** Allowed programming languages for Arena: ARENA_LANGUAGES ids ∩ JUDGE_LANGUAGE */
export const ALLOWED_LANGUAGES = [
  "cpp",
  "c",
  "java",
  "python",
  "pypy3",
  "javascript",
  "typescript",
] as const;

const ALLOWED_LANGUAGES_SET = new Set<string>(ALLOWED_LANGUAGES);

const Solution = z
  .object({
    language: z.string(),
    code: z.string().min(1).max(64 * 1024),
  })
  .strict();

const TestCase = z
  .object({
    input: z.string(),
    output: z.string(),
  })
  .strict();

const Sample = z
  .object({
    input: z.string(),
    output: z.string(),
    explanation: z.string().optional(),
  })
  .strict();

// Build the plain object schema first (so .omit() still works), then refine it.
export const QuestionBaseSchema = ChallengeSchema
  .omit({ date: true }) // AlgoHunt has no Problem-of-the-Day date
  .extend({
    schemaVersion: z.literal(1).default(1),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "must be lowercase letters, digits and hyphens"),
    difficulty: z.enum(["Easy", "Medium", "Hard", "Final"]),
    timeLimit: z
      .string()
      .regex(/^[\d.]+\s*(ms|s)?$/i, 'must look like "1s", "2 s" or "500ms"'), // required here
    memoryLimit: z.string().regex(/^\d+\s*MB$/i, 'must look like "256MB"'), // e.g. "256MB"
    languages: z.array(z.string()).min(1).optional(), // ⊆ ARENA_LANGUAGES ids ∩ JUDGE_LANGUAGE
    tests: z
      .array(TestCase)
      .min(QUESTION_LIMITS.minTests, `At least ${QUESTION_LIMITS.minTests} tests required`)
      .max(QUESTION_LIMITS.maxTests, `At most ${QUESTION_LIMITS.maxTests} tests allowed`),
    samples: z
      .array(Sample)
      .min(1, "At least one sample is required")
      .max(QUESTION_LIMITS.maxSamples, `At most ${QUESTION_LIMITS.maxSamples} samples allowed`),
    referenceSolution: Solution,
    bruteSolution: Solution.optional(),
    editorial: z.string().min(1, "editorial must not be empty").optional(),
    author: z.string().min(1, "author is required"),
  })
  .strict();

export const QuestionSchema = QuestionBaseSchema.superRefine((q, ctx) => {
  const L = QUESTION_LIMITS;

  // 1. Size limits per test and total
  let totalChars = 0;
  for (let i = 0; i < q.tests.length; i++) {
    const t = q.tests[i];
    if (t.input.length > L.maxInputChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tests", i, "input"],
        message: `Test ${i + 1} input is ${t.input.length} chars, max is ${L.maxInputChars}.`,
      });
    }
    if (t.output.length > L.maxOutputChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tests", i, "output"],
        message: `Test ${i + 1} output is ${t.output.length} chars, max is ${L.maxOutputChars}.`,
      });
    }
    totalChars += t.input.length + t.output.length;
  }

  // Include samples in totalChars
  for (let i = 0; i < q.samples.length; i++) {
    const s = q.samples[i];
    totalChars += s.input.length + s.output.length;
  }

  if (totalChars > L.maxTotalChars) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tests"],
      message: `Total test and sample data is ${totalChars} chars, max is ${L.maxTotalChars}.`,
    });
  }

  // 2. Languages valid (subset of ARENA_LANGUAGES ids ∩ JUDGE_LANGUAGE)
  if (q.languages) {
    for (let i = 0; i < q.languages.length; i++) {
      const lang = q.languages[i].toLowerCase();
      if (!ALLOWED_LANGUAGES_SET.has(lang)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["languages", i],
          message: `Language "${q.languages[i]}" is not allowed in Arena. Valid: ${ALLOWED_LANGUAGES.join(", ")}.`,
        });
      }
    }
  }

  // 3. Solution languages in JUDGE_LANGUAGE
  const refLang = q.referenceSolution.language.toLowerCase();
  if (!JUDGE_LANGUAGE[refLang]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["referenceSolution", "language"],
      message: `Reference solution language "${q.referenceSolution.language}" is not supported by judge.`,
    });
  }

  if (q.bruteSolution) {
    const bruteLang = q.bruteSolution.language.toLowerCase();
    if (!JUDGE_LANGUAGE[bruteLang]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bruteSolution", "language"],
        message: `Brute solution language "${q.bruteSolution.language}" is not supported by judge.`,
      });
    }
  }

  // 4. Time limit: 0.5–5 s via parseTimeLimitMs
  const timeMs = parseTimeLimitMs(q.timeLimit);
  if (timeMs < L.minTimeMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["timeLimit"],
      message: `Time limit ${timeMs}ms is below minimum ${L.minTimeMs}ms (0.5s).`,
    });
  } else if (timeMs > L.maxTimeMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["timeLimit"],
      message: `Time limit ${timeMs}ms exceeds maximum ${L.maxTimeMs}ms (5s).`,
    });
  }

  // 5. Memory limit: 32–512 MB
  const memMatch = q.memoryLimit.match(/^(\d+)\s*MB$/i);
  if (memMatch) {
    const memMb = parseInt(memMatch[1], 10);
    if (memMb < L.minMemMb) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memoryLimit"],
        message: `Memory limit ${memMb}MB is below minimum ${L.minMemMb}MB.`,
      });
    } else if (memMb > L.maxMemMb) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memoryLimit"],
        message: `Memory limit ${memMb}MB exceeds maximum ${L.maxMemMb}MB.`,
      });
    }
  }

  // 6. No duplicate test (input) entries
  const seenInputs = new Set<string>();
  for (let i = 0; i < q.tests.length; i++) {
    const inp = q.tests[i].input;
    if (seenInputs.has(inp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tests", i, "input"],
        message: `Test ${i + 1} has duplicate input identical to an earlier test.`,
      });
    }
    seenInputs.add(inp);
  }
});

/** Body of the import COMMIT call: the question WITHOUT tests (they go up in chunks) + the full file's hash. */
export const ChallengeRowSchema = QuestionBaseSchema.omit({ tests: true })
  .extend({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/, "must be 64-character hex SHA-256"),
  })
  .strict();

export type ChallengeRowInput = z.infer<typeof ChallengeRowSchema>;
export type QuestionInput = z.infer<typeof QuestionSchema>;

export type DiagnosticItem = string & {
  path?: string;
  message?: string;
  level?: "error" | "warning";
};

function createDiagnostic(
  message: string,
  path = "",
  level: "error" | "warning" = "warning",
): DiagnosticItem {
  const strObj = new String(message) as DiagnosticItem;
  strObj.path = path;
  strObj.message = message;
  strObj.level = level;
  return strObj;
}

export interface CheckQuestionReport {
  ok: boolean;
  errors: DiagnosticItem[];
  warnings: DiagnosticItem[];
  stats: {
    tests: number;
    testCount?: number;
    samples: number;
    sampleCount?: number;
    totalChars: number;
    largestInputChars: number;
    timeLimitMs?: number;
    memLimitMb?: number;
  };
  sha256?: string;
}

/** Human-readable report: errors block import, warnings don't. */
export function checkQuestion(raw: unknown): CheckQuestionReport {
  const errors: DiagnosticItem[] = [];
  const warnings: DiagnosticItem[] = [];

  const parsed = QuestionSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const p = issue.path.join(".");
      const msg = p ? `[${p}] ${issue.message}` : issue.message;
      errors.push(createDiagnostic(msg, p, "error"));
    }
    return {
      ok: false,
      errors,
      warnings,
      stats: {
        tests: 0,
        samples: 0,
        totalChars: 0,
        largestInputChars: 0,
      },
    };
  }

  const q = parsed.data;
  const L = QUESTION_LIMITS;

  // Compute stats
  let totalChars = 0;
  let largestInputChars = 0;
  for (const t of q.tests) {
    totalChars += t.input.length + t.output.length;
    if (t.input.length > largestInputChars) {
      largestInputChars = t.input.length;
    }
  }
  for (const s of q.samples) {
    totalChars += s.input.length + s.output.length;
  }

  // ── Warnings (advisory, do not block import) ──

  // 1. < 10 tests
  if (q.tests.length < 10) {
    warnings.push(
      createDiagnostic(
        `Only ${q.tests.length} tests (< 10 tests). Consider adding more for robust judging.`,
        "tests",
        "warning",
      ),
    );
  }

  // 2. a sample identical to no test
  for (let sIdx = 0; sIdx < q.samples.length; sIdx++) {
    const s = q.samples[sIdx];
    const match = q.tests.some((t) => t.input === s.input && t.output === s.output);
    if (!match) {
      warnings.push(
        createDiagnostic(
          `Sample ${sIdx + 1} is identical to no test in the test set.`,
          "samples",
          "warning",
        ),
      );
    }
  }

  // 3. no test with input size ≥ 50% of the max seen (no "big" test)
  // Check if any test input reaches at least 50% of the maximum allowed input or max seen
  const bigThreshold = L.maxInputChars * 0.5;
  const hasBigTest = q.tests.some((t) => t.input.length >= bigThreshold);
  if (!hasBigTest) {
    warnings.push(
      createDiagnostic(
        `No test with input size >= 50% of the max seen (no "big" stress test ≥ ${bigThreshold.toLocaleString()} chars).`,
        "tests",
        "warning",
      ),
    );
  }

  // 4. editorial shorter than 200 chars
  if (!q.editorial || q.editorial.trim().length < 200) {
    warnings.push(
      createDiagnostic(
        `Editorial is shorter than 200 chars (${q.editorial ? q.editorial.trim().length : 0} chars).`,
        "editorial",
        "warning",
      ),
    );
  }

  // 5. bruteSolution missing
  if (!q.bruteSolution) {
    warnings.push(
      createDiagnostic(
        "No bruteSolution provided for stress-testing and cross-validation.",
        "bruteSolution",
        "warning",
      ),
    );
  }

  // Canonical SHA-256
  const canonicalJson = JSON.stringify(raw, Object.keys(raw as object).sort());
  const sha256 = crypto.createHash("sha256").update(canonicalJson).digest("hex");

  const memMatch = q.memoryLimit.match(/^(\d+)\s*MB$/i);
  const memLimitMb = memMatch ? parseInt(memMatch[1], 10) : 256;

  return {
    ok: true,
    errors,
    warnings,
    stats: {
      tests: q.tests.length,
      testCount: q.tests.length,
      samples: q.samples.length,
      sampleCount: q.samples.length,
      totalChars,
      largestInputChars,
      timeLimitMs: parseTimeLimitMs(q.timeLimit),
      memLimitMb,
    },
    sha256,
  };
}

export { parseTimeLimitMs, parseMemoryLimitBytes } from "@/lib/challenges";
export { JUDGE_LANGUAGE } from "@/lib/judge";
