import { BASE_POINTS, FLAG_LIMIT, pointsForRank } from "@/lib/points";

/**
 * Pure scoring for one challenge — no database, so it's unit-tested directly.
 *
 * - A **live** solver (a ranked Problem-of-the-Day AC) scores by finish order on
 *   their earliest live AC: more than FLAG_LIMIT integrity flags caps them at the
 *   base score and out of the ranked positions; otherwise `pointsForRank` by their
 *   position among the flag-eligible live solvers, ordered by solve time.
 * - A **late** solver (only practice ACs on a past problem) scores a flat base
 *   score with no rank.
 * - Exactly one award per user. A live solver never also earns the late score.
 */

export interface ScoreInput {
  userId: string;
  /** Server receive time of the AC (finish order). */
  createdAt: number;
  flags: number;
  /** True for a live POTD solve; false for a late/practice solve. */
  ranked: boolean;
}

export interface ScoreResult {
  points: number;
  /** 1-based finish position, or null when out of the ranked positions. */
  rank: number | null;
  flagged: boolean;
  /** The awarding AC's createdAt. */
  createdAt: number;
  /** Whether the award came from a live solve. */
  ranked: boolean;
}

export function scoreChallenge(acs: ScoreInput[]): Map<string, ScoreResult> {
  // Earliest AC per user, split into live vs late.
  const earliestLive = new Map<string, ScoreInput>();
  const earliestLate = new Map<string, ScoreInput>();
  for (const a of acs) {
    const bucket = a.ranked ? earliestLive : earliestLate;
    const cur = bucket.get(a.userId);
    if (!cur || a.createdAt < cur.createdAt) bucket.set(a.userId, a);
  }

  const result = new Map<string, ScoreResult>();

  // Live solvers: rank the flag-eligible ones by finish order.
  const live = [...earliestLive.values()];
  const eligible = live
    .filter((e) => e.flags <= FLAG_LIMIT)
    .sort((x, y) => x.createdAt - y.createdAt);
  eligible.forEach((e, i) =>
    result.set(e.userId, {
      points: pointsForRank(i + 1),
      rank: i + 1,
      flagged: false,
      createdAt: e.createdAt,
      ranked: true,
    }),
  );
  for (const e of live) {
    if (e.flags > FLAG_LIMIT) {
      result.set(e.userId, {
        points: BASE_POINTS,
        rank: null,
        flagged: true,
        createdAt: e.createdAt,
        ranked: true,
      });
    }
  }

  // Late-only solvers: flat base score. A live award always takes precedence.
  for (const [userId, e] of earliestLate) {
    if (result.has(userId)) continue;
    result.set(userId, {
      points: BASE_POINTS,
      rank: null,
      flagged: false,
      createdAt: e.createdAt,
      ranked: false,
    });
  }

  return result;
}
