import { describe, it, expect } from "vitest";
import {
  parseTimeLimitMs,
  parseMemoryLimitBytes,
  isReleased,
  getAllChallenges,
  type Challenge,
} from "./challenges";

function challengeOn(date: string): Challenge {
  return {
    slug: "sample",
    title: "Sample",
    difficulty: "Easy",
    tags: [],
    date,
    statement: "…",
    samples: [],
    checker: { type: "token" },
    tests: [],
  };
}

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
    expect(isReleased(challengeOn("2000-01-01"))).toBe(true);
    expect(isReleased(challengeOn("2999-12-31"))).toBe(false);
  });
});

describe("bundled challenge manifest", () => {
  it("loads valid records with the required public fields", () => {
    const all = getAllChallenges();
    expect(all.length).toBeGreaterThanOrEqual(1);
    for (const c of all) {
      expect(c.slug).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("is sorted newest-first by date", () => {
    const dates = getAllChallenges().map((c) => c.date);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });
});
