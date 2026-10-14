import { describe, it, expect } from "vitest";
import { TEST_QUESTIONS, TEST_PROBLEM_A_PLUS_B, TEST_PROBLEM_MAX_ARRAY, TEST_PROBLEM_COUNT_VOWELS } from "./test-content";
import { QuestionSchema, checkQuestion } from "./question-schema";

describe("AlgoHunt 2.0 test-content", () => {
  it("contains exactly 3 canonical test problems", () => {
    expect(TEST_QUESTIONS).toHaveLength(3);
    expect(TEST_QUESTIONS[0].slug).toBe("tst-a-plus-b");
    expect(TEST_QUESTIONS[1].slug).toBe("tst-max-array");
    expect(TEST_QUESTIONS[2].slug).toBe("tst-count-vowels");
  });

  it("all test problems are valid under QuestionSchema", () => {
    for (const q of TEST_QUESTIONS) {
      const parsed = QuestionSchema.safeParse(q);
      expect(parsed.success, `Schema validation failed for ${q.slug}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it("all test problems pass checkQuestion without errors", () => {
    for (const q of TEST_QUESTIONS) {
      const report = checkQuestion(q);
      expect(report.ok).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.stats.tests).toBeGreaterThanOrEqual(5);
      expect(report.stats.samples).toBeGreaterThanOrEqual(1);
    }
  });

  it("every sample matches a hidden test case", () => {
    for (const q of TEST_QUESTIONS) {
      for (const sample of q.samples) {
        const found = q.tests.some((t) => t.input === sample.input && t.output === sample.output);
        expect(found, `Sample ${sample.input} in ${q.slug} not found in tests`).toBe(true);
      }
    }
  });

  it("checks difficulty progression: Easy -> Medium -> Final", () => {
    expect(TEST_PROBLEM_A_PLUS_B.difficulty).toBe("Easy");
    expect(TEST_PROBLEM_MAX_ARRAY.difficulty).toBe("Medium");
    expect(TEST_PROBLEM_COUNT_VOWELS.difficulty).toBe("Final");
  });
});
