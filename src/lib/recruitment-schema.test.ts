import { describe, it, expect } from "vitest";
import {
  RECRUITMENT_DOMAINS,
  DOMAIN_QUESTIONS,
  WRAP_UP_QUESTIONS,
  countWords,
  DOMAIN_SHORT_NAMES,
} from "./recruitment-schema";

describe("recruitment-schema", () => {
  it("defines the 6 standard recruitment domains", () => {
    expect(RECRUITMENT_DOMAINS).toHaveLength(6);
    expect(RECRUITMENT_DOMAINS).toContain("Competitive Programming");
    expect(RECRUITMENT_DOMAINS).toContain("Technical");
    expect(RECRUITMENT_DOMAINS).toContain("Design");
    expect(RECRUITMENT_DOMAINS).toContain("Events");
    expect(RECRUITMENT_DOMAINS).toContain("Sponsorship");
    expect(RECRUITMENT_DOMAINS).toContain("Social Media & Marketing");
  });

  it("has short names for all 6 domains", () => {
    for (const d of RECRUITMENT_DOMAINS) {
      expect(DOMAIN_SHORT_NAMES[d]).toBeDefined();
      expect(DOMAIN_SHORT_NAMES[d].length).toBeGreaterThan(0);
    }
  });

  it("has questions for every domain", () => {
    for (const d of RECRUITMENT_DOMAINS) {
      const questions = DOMAIN_QUESTIONS[d];
      expect(questions).toBeDefined();
      expect(questions.length).toBeGreaterThan(0);
      for (const q of questions) {
        expect(q.id).toBeDefined();
        expect(q.label).toBeDefined();
        expect(q.type).toBeDefined();
      }
    }
  });

  it("has wrap-up questions", () => {
    expect(WRAP_UP_QUESTIONS.length).toBeGreaterThan(0);
    for (const q of WRAP_UP_QUESTIONS) {
      expect(q.id).toBeDefined();
      expect(q.label).toBeDefined();
    }
  });

  describe("countWords", () => {
    it("returns 0 for empty and whitespace strings", () => {
      expect(countWords("")).toBe(0);
      expect(countWords("   ")).toBe(0);
      expect(countWords("\n\t ")).toBe(0);
    });

    it("counts single word", () => {
      expect(countWords("hello")).toBe(1);
    });

    it("counts multiple words separated by various whitespace", () => {
      expect(countWords("hello world this is a test")).toBe(6);
      expect(countWords("hello   world \n\t another")).toBe(3);
    });
  });
});
