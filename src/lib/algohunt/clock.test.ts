import { describe, expect, it } from "vitest";
import { countdownLevel, formatCountdown, isTimeUp } from "./clock";

describe("isTimeUp", () => {
  it("never stops play without a scheduled end", () => {
    expect(isTimeUp(null, Date.now())).toBe(false);
  });

  it("stops play from the exact end moment", () => {
    expect(isTimeUp(1_000, 999)).toBe(false);
    expect(isTimeUp(1_000, 1_000)).toBe(true);
    expect(isTimeUp(1_000, 5_000)).toBe(true);
  });
});

describe("countdownLevel", () => {
  it("escalates at 30 and 10 minutes", () => {
    expect(countdownLevel(45 * 60_000)).toBe("normal");
    expect(countdownLevel(30 * 60_000)).toBe("warning");
    expect(countdownLevel(10 * 60_000 + 1)).toBe("warning");
    expect(countdownLevel(10 * 60_000)).toBe("critical");
    expect(countdownLevel(1)).toBe("critical");
    expect(countdownLevel(0)).toBe("over");
    expect(countdownLevel(-5_000)).toBe("over");
  });
});

describe("formatCountdown", () => {
  it("pads hours, minutes and seconds", () => {
    expect(formatCountdown(4 * 3_600_000)).toBe("04:00:00");
    expect(formatCountdown(2 * 3_600_000 + 7 * 60_000 + 45_000)).toBe("02:07:45");
  });

  it("rounds up partial seconds and never goes negative", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-10_000)).toBe("00:00:00");
  });
});
