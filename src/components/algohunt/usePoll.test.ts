import { afterEach, describe, expect, it, vi } from "vitest";
import { nextDelay } from "./usePoll";

const noJitter = () => 0.5; // (0.5 * 2 - 1) = 0
const lowest = () => 0; // -1 * jitter
const highest = () => 1; // +1 * jitter

describe("nextDelay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the base interval when there are no failures", () => {
    expect(nextDelay(8000, 0, 0)).toBe(8000);
    expect(nextDelay(8000, 1000, 0, noJitter)).toBe(8000);
    expect(nextDelay(5000, 500, 0, noJitter)).toBe(5000);
  });

  it("doubles the interval for each consecutive failure", () => {
    expect(nextDelay(8000, 0, 1, noJitter)).toBe(16000);
    expect(nextDelay(8000, 0, 2, noJitter)).toBe(32000);
    expect(nextDelay(2000, 0, 1, noJitter)).toBe(4000);
  });

  it("caps backoff at 4x the interval", () => {
    expect(nextDelay(8000, 0, 2, noJitter)).toBe(32000);
    expect(nextDelay(8000, 0, 3, noJitter)).toBe(32000);
    expect(nextDelay(8000, 0, 10, noJitter)).toBe(32000);
    expect(nextDelay(8000, 0, 5000, noJitter)).toBe(32000);
  });

  it("applies symmetric jitter within ±jitterMs", () => {
    expect(nextDelay(8000, 1000, 0, lowest)).toBe(7000);
    expect(nextDelay(8000, 1000, 0, highest)).toBe(9000);
    expect(nextDelay(8000, 1000, 0, () => 0.75)).toBe(8500);
    expect(nextDelay(8000, 1000, 0, () => 0.25)).toBe(7500);
    // Jitter is added after the cap.
    expect(nextDelay(8000, 1000, 9, highest)).toBe(33000);
    expect(nextDelay(8000, 1000, 9, lowest)).toBe(31000);
  });

  it("keeps randomly jittered delays within bounds", () => {
    for (let i = 0; i < 1000; i++) {
      const delay = nextDelay(8000, 1500, 0);
      expect(delay).toBeGreaterThanOrEqual(6500);
      expect(delay).toBeLessThanOrEqual(9500);
    }
  });

  it("uses Math.random when no rand is given", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(nextDelay(8000, 1000, 0)).toBe(9000);
  });

  it("never returns less than 1000ms", () => {
    expect(nextDelay(500, 0, 0, noJitter)).toBe(1000);
    expect(nextDelay(0, 0, 0, noJitter)).toBe(1000);
    expect(nextDelay(1200, 1000, 0, lowest)).toBe(1000);
    expect(nextDelay(1000, 5000, 0, lowest)).toBe(1000);
    // Backoff can lift a tiny interval above the floor.
    expect(nextDelay(400, 0, 2, noJitter)).toBe(1600);
  });

  it("treats negative failure counts as zero", () => {
    expect(nextDelay(8000, 0, -3, noJitter)).toBe(8000);
  });
});
