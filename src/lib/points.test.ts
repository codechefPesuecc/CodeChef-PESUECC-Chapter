import { describe, it, expect } from "vitest";
import {
  pointsForRank,
  ordinal,
  BOUNTY_LADDER,
  SPEED_BOUNTY,
  BASE_POINTS,
} from "./points";

describe("pointsForRank", () => {
  it("awards the speed bounty for the top ranks", () => {
    expect(pointsForRank(1)).toBe(1000);
    expect(pointsForRank(2)).toBe(800);
    expect(pointsForRank(9)).toBe(150);
  });

  it("awards base points from 10th onward", () => {
    expect(pointsForRank(10)).toBe(BASE_POINTS);
    expect(pointsForRank(100)).toBe(BASE_POINTS);
  });

  it("treats non-positive/invalid ranks as base", () => {
    expect(pointsForRank(0)).toBe(BASE_POINTS);
    expect(pointsForRank(-3)).toBe(BASE_POINTS);
  });
});

describe("ordinal", () => {
  it("uses the right suffix for common numbers", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
  });

  it("handles the 11-13 exception", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(111)).toBe("111th");
    expect(ordinal(112)).toBe("112th");
  });
});

describe("BOUNTY_LADDER", () => {
  it("is one row per bounty tier plus a base row", () => {
    expect(BOUNTY_LADDER).toHaveLength(SPEED_BOUNTY.length + 1);
    expect(BOUNTY_LADDER[0]).toEqual({ label: "1st", points: 1000 });
    expect(BOUNTY_LADDER.at(-1)).toEqual({ label: "10th+", points: BASE_POINTS });
  });
});
