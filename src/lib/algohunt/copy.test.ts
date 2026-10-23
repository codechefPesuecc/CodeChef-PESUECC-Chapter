import { describe, expect, it } from "vitest";
import { COPY, cooldownMessage, formatCooldown, formatCooldownClock } from "./copy";

describe("cooldown copy", () => {
  it("reads the wait in minutes and seconds, never raw seconds", () => {
    expect(formatCooldown(520)).toBe("8 min 40 s");
    expect(formatCooldown(600)).toBe("10 min");
    expect(formatCooldown(45)).toBe("45 s");
    expect(formatCooldown(59.2)).toBe("1 min");
    expect(formatCooldown(-3)).toBe("0 s");
  });

  it("shows a clock on the locked button", () => {
    expect(formatCooldownClock(520)).toBe("8:40");
    expect(formatCooldownClock(600)).toBe("10:00");
    expect(formatCooldownClock(5)).toBe("0:05");
  });

  it("tells the team how long code entry stays locked", () => {
    expect(cooldownMessage(520)).toBe("Too many invalid codes. Code entry is locked: please wait 8 min 40 s before trying again.");
    expect(COPY.errors.COOLDOWN).toContain("up to 10 minutes");
  });
});
