import { describe, it, expect } from "vitest";
import { scoreChallenge, type ScoreInput } from "./scoring";
import { BASE_POINTS } from "./points";

function ac(
  userId: string,
  createdAt: number,
  opts: { flags?: number; ranked?: boolean; elapsedSeconds?: number | null } = {},
): ScoreInput {
  return {
    userId,
    createdAt,
    // Default the arena timer to createdAt so cases that only vary finish order
    // read naturally; solve-time-specific cases pass elapsedSeconds explicitly.
    elapsedSeconds: opts.elapsedSeconds === undefined ? createdAt : opts.elapsedSeconds,
    flags: opts.flags ?? 0,
    ranked: opts.ranked ?? true,
  };
}

describe("scoreChallenge", () => {
  it("awards speed-bounty points by fastest solve time", () => {
    const r = scoreChallenge([ac("a", 1), ac("b", 2), ac("c", 3)]);
    expect(r.get("a")).toMatchObject({ rank: 1, points: 1000 });
    expect(r.get("b")).toMatchObject({ rank: 2, points: 800 });
    expect(r.get("c")).toMatchObject({ rank: 3, points: 600 });
  });

  it("ranks by elapsed solve time (the arena timer), not wall-clock finish order", () => {
    // b submits first in wall-clock (createdAt 5 < 10) but took longer on the
    // arena timer (50s vs 30s), so a — the faster solve — ranks above b.
    const r = scoreChallenge([
      ac("a", 10, { elapsedSeconds: 30 }),
      ac("b", 5, { elapsedSeconds: 50 }),
    ]);
    expect(r.get("a")).toMatchObject({ rank: 1, points: 1000 });
    expect(r.get("b")).toMatchObject({ rank: 2, points: 800 });
  });

  it("sorts a missing solve clock (null elapsed) last among eligible solvers", () => {
    // a has no attempt clock; despite finishing first it ranks below b's real time.
    const r = scoreChallenge([
      ac("a", 1, { elapsedSeconds: null }),
      ac("b", 2, { elapsedSeconds: 20 }),
    ]);
    expect(r.get("b")).toMatchObject({ rank: 1, points: 1000 });
    expect(r.get("a")).toMatchObject({ rank: 2, points: 800 });
  });

  it("orders two null-elapsed solvers deterministically by finish order", () => {
    const r = scoreChallenge([
      ac("late", 2, { elapsedSeconds: null }),
      ac("early", 1, { elapsedSeconds: null }),
    ]);
    expect(r.get("early")).toMatchObject({ rank: 1 });
    expect(r.get("late")).toMatchObject({ rank: 2 });
  });

  it("uses a user's earliest live AC", () => {
    const r = scoreChallenge([ac("a", 5), ac("a", 2), ac("b", 3)]);
    // a's earliest (t=2) beats b (t=3) → a is rank 1.
    expect(r.get("a")).toMatchObject({ rank: 1, createdAt: 2 });
    expect(r.get("b")).toMatchObject({ rank: 2 });
    expect(r.size).toBe(2);
  });

  it("flags a >FLAG_LIMIT solve to base points and out of the ranked positions", () => {
    const r = scoreChallenge([
      ac("a", 1),
      ac("b", 2, { flags: 6 }),
      ac("c", 3),
    ]);
    expect(r.get("a")).toMatchObject({ rank: 1, points: 1000, flagged: false });
    // b is flagged → base points, no rank, and does NOT consume rank 2.
    expect(r.get("b")).toMatchObject({ rank: null, points: BASE_POINTS, flagged: true });
    expect(r.get("c")).toMatchObject({ rank: 2, points: 800 });
  });

  it("gives late-only (practice) solvers a flat base score with no rank", () => {
    const r = scoreChallenge([ac("a", 100, { ranked: false })]);
    expect(r.get("a")).toMatchObject({
      rank: null,
      points: BASE_POINTS,
      flagged: false,
      ranked: false,
    });
  });

  it("never double-awards: a live solver does not also get the late score", () => {
    const r = scoreChallenge([
      ac("a", 1), // live
      ac("a", 50, { ranked: false }), // later practice solve of the same problem
    ]);
    expect(r.size).toBe(1);
    expect(r.get("a")).toMatchObject({ rank: 1, points: 1000, ranked: true });
  });

  it("ranks live solvers and separately credits late solvers", () => {
    const r = scoreChallenge([
      ac("live", 1),
      ac("late", 2, { ranked: false }),
    ]);
    expect(r.get("live")).toMatchObject({ rank: 1, points: 1000 });
    expect(r.get("late")).toMatchObject({ rank: null, points: BASE_POINTS, ranked: false });
  });

  it("returns an empty map for no solves", () => {
    expect(scoreChallenge([]).size).toBe(0);
  });
});
