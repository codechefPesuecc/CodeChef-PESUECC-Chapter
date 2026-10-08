import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatCodeForDisplay,
  generateCode,
  isWellFormedCode,
  normalizeCode,
} from "./codes";

describe("algohunt codes helpers", () => {
  it("normalizes codes correctly", () => {
    expect(normalizeCode("  7fq2-m8k3  ")).toBe("7FQ2M8K3");
    expect(normalizeCode("7fq2_m8k3")).toBe("7FQ2M8K3");
    expect(normalizeCode(" 7 F q 2 - M 8 k 3 ")).toBe("7FQ2M8K3");
    expect(normalizeCode("abc_def-ghi 123")).toBe("ABCDEFGHI123");
  });

  it("validates well-formed codes", () => {
    expect(isWellFormedCode("7FQ2M8K3")).toBe(true);
    // 7 or 9 characters
    expect(isWellFormedCode("7FQ2M8K")).toBe(false);
    expect(isWellFormedCode("7FQ2M8K3A")).toBe(false);
    // Disallowed chars (0, O, 1, I, L)
    expect(isWellFormedCode("0FQ2M8K3")).toBe(false);
    expect(isWellFormedCode("OFQ2M8K3")).toBe(false);
    expect(isWellFormedCode("1FQ2M8K3")).toBe(false);
    expect(isWellFormedCode("IFQ2M8K3")).toBe(false);
    expect(isWellFormedCode("LFQ2M8K3")).toBe(false);
    expect(isWellFormedCode("7FQ2-8K3")).toBe(false);
  });

  it("generateCode produces 10,000 valid unique codes covering every alphabet char", () => {
    const samples = new Set<string>();
    const charCounts: Record<string, number> = {};
    for (const ch of CODE_ALPHABET) {
      charCounts[ch] = 0;
    }

    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const code = generateCode();
      expect(code.length).toBe(CODE_LENGTH);
      expect(isWellFormedCode(code)).toBe(true);
      samples.add(code);
      for (const ch of code) {
        charCounts[ch] = (charCounts[ch] || 0) + 1;
      }
    }

    // No duplicates in 10k random 8-character codes from 30^8 pool (birthday collision probability ~ 0.007%)
    expect(samples.size).toBe(N);

    // Every character from CODE_ALPHABET should appear across 10,000 * 8 = 80,000 characters
    for (const ch of CODE_ALPHABET) {
      expect(charCounts[ch]).toBeGreaterThan(0);
    }
  });

  it("formats codes for display", () => {
    expect(formatCodeForDisplay("7FQ2M8K3")).toBe("7FQ2-M8K3");
    expect(formatCodeForDisplay("7FQ2")).toBe("7FQ2");
    expect(formatCodeForDisplay("7F")).toBe("7F");
  });
});
