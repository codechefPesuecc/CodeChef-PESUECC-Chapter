import { describe, expect, it } from "vitest";
import { REASON_MAX_CHARS, REASON_MIN_CHARS, canConfirm } from "./ConfirmAction";

const reasonValid = (reason: string) =>
  canConfirm({ phrase: "x", typed: "x", requireReason: true, reason });
const phraseMatches = (phrase: string, typed: string) =>
  canConfirm({ phrase, typed, requireReason: false, reason: "" });

describe("phraseMatches", () => {
  it("needs the exact text", () => {
    expect(phraseMatches("algohunt-2026", "algohunt-2026")).toBe(true);
    expect(phraseMatches("algohunt-2026", "Algohunt-2026")).toBe(false);
    expect(phraseMatches("algohunt-2026", "algohunt-2026 ")).toBe(false);
    expect(phraseMatches("algohunt-2026", "")).toBe(false);
  });

  it("never matches when the required phrase is empty", () => {
    expect(phraseMatches("", "")).toBe(false);
  });
});

describe("reasonValid", () => {
  it("accepts 5 to 500 characters after trimming", () => {
    expect(reasonValid("a".repeat(REASON_MIN_CHARS))).toBe(true);
    expect(reasonValid("a".repeat(REASON_MAX_CHARS))).toBe(true);
    expect(reasonValid("a".repeat(REASON_MIN_CHARS - 1))).toBe(false);
    expect(reasonValid("a".repeat(REASON_MAX_CHARS + 1))).toBe(false);
    expect(reasonValid("   ab   ")).toBe(false);
  });
});

describe("canConfirm", () => {
  const base = { phrase: "AH2-T019", typed: "AH2-T019", requireReason: true, reason: "QR pool empty" };

  it("is ready when the phrase matches and the reason is valid", () => {
    expect(canConfirm(base)).toBe(true);
  });

  it("stays disabled for a wrong phrase", () => {
    expect(canConfirm({ ...base, typed: "AH2-T01" })).toBe(false);
  });

  it("stays disabled for a missing or short reason when one is required", () => {
    expect(canConfirm({ ...base, reason: "" })).toBe(false);
    expect(canConfirm({ ...base, reason: "no" })).toBe(false);
  });

  it("ignores the reason when none is required", () => {
    expect(canConfirm({ ...base, requireReason: false, reason: "" })).toBe(true);
  });
});
