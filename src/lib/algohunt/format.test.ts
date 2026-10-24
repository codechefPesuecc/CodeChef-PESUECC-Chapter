import { describe, expect, it } from "vitest";
import { formatDuration, formatIST } from "./format";

describe("formatIST", () => {
  it("uses the India time zone for a timestamp near midnight", () => {
    const ms = Date.parse("2026-10-06T05:12:11.000Z");
    expect(formatIST(ms)).toBe("10:42:11 AM");
  });

  it("includes the date on request", () => {
    const ms = Date.parse("2026-10-06T05:12:11.000Z");
    expect(formatIST(ms, { withDate: true })).toContain("6 Oct 2026");
  });
});

describe("formatDuration", () => {
  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0m 00s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(277_000)).toBe("4m 37s");
  });

  it("formats hours with padded minutes and seconds", () => {
    expect(formatDuration(3_877_000)).toBe("1h 04m 37s");
  });
});
