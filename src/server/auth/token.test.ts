import { describe, it, expect, beforeAll, vi } from "vitest";
import { createSessionToken, readSessionToken } from "./token";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-unit-tests";
});

describe("session token", () => {
  it("round-trips the user id and epoch", () => {
    const token = createSessionToken("user-123", 7);
    expect(readSessionToken(token)).toEqual({ userId: "user-123", epoch: 7 });
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken("user-123", 0);
    const flipped = token.endsWith("aa")
      ? token.slice(0, -2) + "bb"
      : token.slice(0, -2) + "aa";
    expect(readSessionToken(flipped)).toBeNull();
  });

  it("rejects a forged payload (re-used signature)", () => {
    const token = createSessionToken("user-123", 0);
    const dot = token.lastIndexOf(".");
    const [uid, epoch, expiry] = token.slice(0, dot).split(":");
    void uid;
    const forged = `evil:${epoch}:${expiry}${token.slice(dot)}`;
    expect(readSessionToken(forged)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(readSessionToken("garbage")).toBeNull();
    expect(readSessionToken("")).toBeNull();
    expect(readSessionToken("a.b")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
    const token = createSessionToken("user-123", 0);
    // 60 days later — well past the 30-day max age.
    vi.setSystemTime(new Date("2020-03-01T00:00:00Z"));
    expect(readSessionToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("is bound to the epoch — a different epoch is a different token", () => {
    const a = createSessionToken("user-123", 0);
    const b = createSessionToken("user-123", 1);
    expect(a).not.toBe(b);
    expect(readSessionToken(a)?.epoch).toBe(0);
    expect(readSessionToken(b)?.epoch).toBe(1);
  });
});
