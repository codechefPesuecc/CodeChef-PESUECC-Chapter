import { describe, it, expect } from "vitest";
import {
  QUESTION_LIMITS,
  QuestionBaseSchema,
  QuestionSchema,
  ChallengeRowSchema,
  checkQuestion,
} from "@/lib/algohunt/question-schema";

function validQuestion() {
  return {
    schemaVersion: 1 as const,
    slug: "test-problem",
    title: "Test Problem",
    difficulty: "Easy" as "Easy" | "Medium" | "Hard" | "Final",
    tags: ["math"],
    timeLimit: "2s",
    memoryLimit: "256MB",
    author: "test-author",
    statement: "Given N, print N+1.",
    inputFormat: "A single integer N.",
    outputFormat: "A single integer N+1.",
    constraints: "1 <= N <= 10^9",
    editorial: "Simply add 1 to N. This is a trivial problem that tests basic I/O. Time complexity is O(1). ".repeat(3),
    samples: [
      { input: "5", output: "6", explanation: "N=5, so N+1=6." },
    ] as Array<{ input: string; output: string; explanation?: string }>,
    tests: Array.from({ length: 10 }, (_, i) => ({
      input: String(i + 1),
      output: String(i + 2),
    })),
    checker: { type: "token" } as { type: "exact" | "token" | "float"; epsilon?: number },
    referenceSolution: {
      language: "python",
      code: "n = int(input())\nprint(n + 1)",
    },
    bruteSolution: undefined as { language: string; code: string } | undefined,
  };
}

describe("question-schema limits", () => {
  it("1. QUESTION_LIMITS constants - verify sensible limits", () => {
    expect(QUESTION_LIMITS.minTests).toBe(5);
    expect(QUESTION_LIMITS.maxTests).toBe(60);
    expect(QUESTION_LIMITS.minTests).toBeLessThan(QUESTION_LIMITS.maxTests);
    expect(QUESTION_LIMITS.maxSamples).toBe(5);
    expect(QUESTION_LIMITS.maxInputChars).toBe(1_500_000);
    expect(QUESTION_LIMITS.maxOutputChars).toBe(400_000);
    expect(QUESTION_LIMITS.maxTotalChars).toBe(12_000_000);
    expect(QUESTION_LIMITS.minTimeMs).toBe(500);
    expect(QUESTION_LIMITS.maxTimeMs).toBe(5000);
    expect(QUESTION_LIMITS.minMemMb).toBe(32);
    expect(QUESTION_LIMITS.maxMemMb).toBe(512);
  });
});

describe("QuestionSchema validations", () => {
  it("2. QuestionSchema - valid question passes both safeParse and checkQuestion", () => {
    const q = validQuestion();
    const parseResult = QuestionSchema.safeParse(q);
    expect(parseResult.success).toBe(true);

    const checkResult = checkQuestion(q);
    expect(checkResult.ok).toBe(true);
    expect(checkResult.errors).toHaveLength(0);
  });

  it("3. QuestionSchema - missing required fields", () => {
    const q: Record<string, unknown> = validQuestion();
    delete q.title;
    delete q.statement;
    delete q.samples;
    delete q.tests;
    delete q.referenceSolution;

    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues ?? [];
      const errPaths = issues.map((e) => e.path[0]);
      expect(errPaths).toContain("title");
      expect(errPaths).toContain("statement");
      expect(errPaths).toContain("samples");
      expect(errPaths).toContain("tests");
      expect(errPaths).toContain("referenceSolution");
    }
  });

  it("4. QuestionSchema - test count below minimum", () => {
    const q = validQuestion();
    q.tests = Array.from({ length: 3 }, (_, i) => ({ input: String(i), output: String(i) }));
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("5. QuestionSchema - test count at exact minimum", () => {
    const q = validQuestion();
    q.tests = Array.from({ length: QUESTION_LIMITS.minTests }, (_, i) => ({ input: String(i), output: String(i) }));
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(true);
  });

  it("6. QuestionSchema - test count above maximum", () => {
    const q = validQuestion();
    q.tests = Array.from({ length: QUESTION_LIMITS.maxTests + 1 }, (_, i) => ({ input: String(i), output: String(i) }));
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("7. QuestionSchema - too many samples", () => {
    const q = validQuestion();
    q.samples = Array.from({ length: QUESTION_LIMITS.maxSamples + 1 }, (_, i) => ({
      input: String(i),
      output: String(i),
    }));
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("8. QuestionSchema - input too large", () => {
    const q = validQuestion();
    q.tests[0].input = "x".repeat(QUESTION_LIMITS.maxInputChars + 1);
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("9. QuestionSchema - output too large", () => {
    const q = validQuestion();
    q.tests[0].output = "x".repeat(QUESTION_LIMITS.maxOutputChars + 1);
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("10. QuestionSchema - total chars exceeded", () => {
    const q = validQuestion();
    q.tests = Array.from({ length: 15 }, (_, i) => ({
      input: "x".repeat(1_000_000),
      output: String(i),
    }));
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("11. QuestionSchema - time limit too low", () => {
    const q = validQuestion();
    q.timeLimit = "100ms";
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("12. QuestionSchema - time limit too high", () => {
    const q = validQuestion();
    q.timeLimit = "10s";
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("13. QuestionSchema - memory limit too low", () => {
    const q = validQuestion();
    q.memoryLimit = "16MB";
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("14. QuestionSchema - memory limit too high", () => {
    const q = validQuestion();
    q.memoryLimit = "1024MB";
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("15. QuestionSchema - unsupported reference language", () => {
    const q = validQuestion();
    q.referenceSolution = { language: "haskell", code: "main = print 1" };
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("16. QuestionSchema - unsupported brute language", () => {
    const q = {
      ...validQuestion(),
      bruteSolution: { language: "haskell", code: "main = print 1" },
    };
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("17. QuestionSchema - duplicate test inputs", () => {
    const q = validQuestion();
    q.tests[0].input = "duplicate";
    q.tests[1].input = "duplicate";
    const result = QuestionSchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("25. QuestionSchema - valid checker types", () => {
    const q1 = validQuestion();
    q1.checker = { type: "exact" };
    expect(QuestionSchema.safeParse(q1).success).toBe(true);

    const q2 = validQuestion();
    q2.checker = { type: "token" };
    expect(QuestionSchema.safeParse(q2).success).toBe(true);

    const q3 = validQuestion();
    q3.checker = { type: "float" };
    expect(QuestionSchema.safeParse(q3).success).toBe(true);
  });

  it("26. QuestionSchema - float checker with epsilon", () => {
    const q = validQuestion();
    q.checker = { type: "float", epsilon: 1e-6 };
    expect(QuestionSchema.safeParse(q).success).toBe(true);
  });
});

describe("checkQuestion validations and warnings", () => {
  it("18. checkQuestion - warnings for low test count", () => {
    const q = validQuestion();
    q.tests = Array.from({ length: 5 }, (_, i) => ({ input: String(i), output: String(i) }));
    const result = checkQuestion(q);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => String(w).includes("< 10"))).toBe(true);
  });

  it("19. checkQuestion - warning for missing editorial", () => {
    const q: Record<string, unknown> = validQuestion();
    delete q.editorial;
    const result = checkQuestion(q);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => (w as { path?: string }).path === "editorial")).toBe(true);
  });

  it("20. checkQuestion - warning for short editorial", () => {
    const q = validQuestion();
    q.editorial = "x".repeat(50);
    const result = checkQuestion(q);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => (w as { path?: string }).path === "editorial")).toBe(true);
  });

  it("21. checkQuestion - warning for no brute solution", () => {
    const q = validQuestion();
    const result = checkQuestion(q);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => (w as { path?: string }).path === "bruteSolution")).toBe(true);
  });

  it("22. checkQuestion - warning for no big test", () => {
    const q = validQuestion();
    const result = checkQuestion(q);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => String(w).toLowerCase().includes("stress"))).toBe(true);
  });

  it("23. checkQuestion - stats are computed correctly", () => {
    const q = validQuestion();
    const result = checkQuestion(q);
    expect(result.ok).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats?.tests).toBe(q.tests.length);
    expect(result.stats?.testCount).toBe(q.tests.length);
    expect(result.stats?.samples).toBe(q.samples.length);
    expect(result.stats?.sampleCount).toBe(q.samples.length);
    expect(result.stats?.timeLimitMs).toBe(2000);
    expect(result.stats?.memLimitMb).toBe(256);
  });

  it("24. checkQuestion - invalid input returns ok: false", () => {
    const result = checkQuestion({});
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("ChallengeRowSchema and QuestionBaseSchema", () => {
  it("validates ChallengeRowSchema omitting tests and requiring sourceSha256", () => {
    const q = validQuestion();
    const rowInput = {
      ...q,
      sourceSha256: "a".repeat(64),
    };
    const rowWithoutTests: Record<string, unknown> = { ...rowInput };
    delete rowWithoutTests.tests;
    const res = ChallengeRowSchema.safeParse(rowWithoutTests);
    expect(res.success).toBe(true);

    // with bad hash should fail
    const badHash = { ...rowWithoutTests, sourceSha256: "not-64-hex" };
    expect(ChallengeRowSchema.safeParse(badHash).success).toBe(false);
  });

  it("allows QuestionBaseSchema to omit date and maintain POTD parity", () => {
    const q = validQuestion();
    expect(QuestionBaseSchema.safeParse(q).success).toBe(true);
  });
});
