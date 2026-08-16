import { describe, it, expect } from "vitest";
import {
  parseTimeLimitMs,
  parseMemoryLimitBytes,
  isReleased,
  toPublicContent,
  type Challenge,
} from "./challenges";

// These cover the pure helpers only. The readers (getDailyChallenge, …) hit the
// database and are exercised by the end-to-end/seed flow, not unit tests.

describe("parseTimeLimitMs", () => {
  it("parses seconds and milliseconds", () => {
    expect(parseTimeLimitMs("1s")).toBe(1000);
    expect(parseTimeLimitMs("2 s")).toBe(2000);
    expect(parseTimeLimitMs("500ms")).toBe(500);
    expect(parseTimeLimitMs("1.5s")).toBe(1500);
  });

  it("falls back when absent or unparseable", () => {
    expect(parseTimeLimitMs(undefined)).toBe(2000);
    expect(parseTimeLimitMs("abc")).toBe(2000);
    expect(parseTimeLimitMs(undefined, 3000)).toBe(3000);
  });
});

describe("parseMemoryLimitBytes", () => {
  it("parses binary units (MB == MiB)", () => {
    expect(parseMemoryLimitBytes("256 MB", 0)).toBe(256 * 1024 * 1024);
    expect(parseMemoryLimitBytes("256MiB", 0)).toBe(256 * 1024 * 1024);
    expect(parseMemoryLimitBytes("512m", 0)).toBe(512 * 1024 * 1024);
    expect(parseMemoryLimitBytes("1g", 0)).toBe(1024 ** 3);
  });

  it("falls back when absent or unparseable", () => {
    expect(parseMemoryLimitBytes(undefined, 42)).toBe(42);
    expect(parseMemoryLimitBytes("nope", 42)).toBe(42);
  });
});

describe("isReleased", () => {
  it("releases past-dated problems and hides future-dated ones", () => {
    expect(isReleased({ date: "2000-01-01" })).toBe(true);
    expect(isReleased({ date: "2999-12-31" })).toBe(false);
  });
});

describe("toPublicContent", () => {
  it("strips hidden tests and the checker", () => {
    const full: Challenge = {
      slug: "sample",
      title: "Sample",
      difficulty: "Easy",
      tags: ["x"],
      date: "2026-01-01",
      statement: "…",
      samples: [{ input: "1", output: "2" }],
      contentHtml: {
        statement: "<p>…</p>",
        inputFormat: "",
        outputFormat: "",
        constraints: "",
        sampleExplanations: [],
      },
      checker: { type: "token" },
      tests: [{ input: "3", output: "4" }],
    };
    const pub = toPublicContent(full);
    expect(pub).not.toHaveProperty("tests");
    expect(pub).not.toHaveProperty("checker");
    expect(pub.slug).toBe("sample");
    expect(pub.samples).toHaveLength(1);
    expect(pub.contentHtml.statement).toBe("<p>…</p>");
  });
});
