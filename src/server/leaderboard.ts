import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { submissions, users } from "@/server/db/schema";
import { getDailyChallenge } from "@/lib/challenges";
import { BASE_POINTS, FLAG_LIMIT, pointsForRank } from "@/lib/points";

/**
 * Leaderboards derived from persisted submissions. Ranking is by finish order —
 * the server timestamp of a user's first Accepted submission — so it can't be
 * spoofed. A solve with more than FLAG_LIMIT integrity flags is capped at the
 * base points and excluded from the ranked positions (mirrors the 5-flag rule).
 */

export interface LeaderRow {
  rank: number | null; // null = flagged (out of the ranked top 10)
  username: string;
  points: number;
  flagged: boolean;
  solved?: number; // month / all-time
  language?: string; // today
  timeSeconds?: number | null; // today (client-reported solve duration)
}

interface Ac {
  userId: string;
  createdAt: number;
  flags: number;
  elapsedSeconds: number | null;
  language: string;
}

/** Per-user points for one challenge, from its accepted submissions. */
function scoreChallenge(acs: Ac[]) {
  // Earliest AC per user is what counts.
  const firstByUser = new Map<string, Ac>();
  for (const a of acs) {
    const cur = firstByUser.get(a.userId);
    if (!cur || a.createdAt < cur.createdAt) firstByUser.set(a.userId, a);
  }
  const entries = [...firstByUser.values()];

  const eligible = entries
    .filter((e) => e.flags <= FLAG_LIMIT)
    .sort((x, y) => x.createdAt - y.createdAt);

  const result = new Map<
    string,
    { points: number; rank: number | null; flagged: boolean; ac: Ac }
  >();
  eligible.forEach((e, i) =>
    result.set(e.userId, { points: pointsForRank(i + 1), rank: i + 1, flagged: false, ac: e }),
  );
  for (const e of entries) {
    if (e.flags > FLAG_LIMIT) {
      result.set(e.userId, { points: BASE_POINTS, rank: null, flagged: true, ac: e });
    }
  }
  return result;
}

async function acRows() {
  return db
    .select({
      userId: submissions.userId,
      challengeSlug: submissions.challengeSlug,
      createdAt: submissions.createdAt,
      flags: submissions.flags,
      elapsedSeconds: submissions.elapsedSeconds,
      language: submissions.language,
      username: users.username,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .where(eq(submissions.status, "AC"));
}

/** Today's problem: finish-order standings with the speed-bounty points. */
export async function todayLeaderboard(): Promise<LeaderRow[]> {
  const daily = getDailyChallenge();
  if (!daily) return [];

  const rows = await db
    .select({
      userId: submissions.userId,
      createdAt: submissions.createdAt,
      flags: submissions.flags,
      elapsedSeconds: submissions.elapsedSeconds,
      language: submissions.language,
      username: users.username,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .where(and(eq(submissions.challengeSlug, daily.slug), eq(submissions.status, "AC")));

  const usernameById = new Map(rows.map((r) => [r.userId, r.username]));
  const scored = scoreChallenge(rows);

  const out: LeaderRow[] = [...scored.entries()].map(([userId, s]) => ({
    rank: s.rank,
    username: usernameById.get(userId) ?? "unknown",
    points: s.points,
    flagged: s.flagged,
    language: s.ac.language,
    timeSeconds: s.ac.elapsedSeconds,
  }));
  out.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return out;
}

/**
 * Month / all-time: sum of each user's per-challenge points. Month uses the
 * challenge date encoded in the slug prefix (YYYY-MM-DD-…).
 */
export async function aggregateLeaderboard(scope: "month" | "all"): Promise<LeaderRow[]> {
  const rows = await acRows();
  const usernameById = new Map(rows.map((r) => [r.userId, r.username]));

  const bySlug = new Map<string, Ac[]>();
  for (const r of rows) {
    const list = bySlug.get(r.challengeSlug) ?? [];
    list.push({
      userId: r.userId,
      createdAt: r.createdAt,
      flags: r.flags,
      elapsedSeconds: r.elapsedSeconds,
      language: r.language,
    });
    bySlug.set(r.challengeSlug, list);
  }

  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const totals = new Map<string, { points: number; solved: number }>();
  for (const [slug, acs] of bySlug) {
    if (scope === "month" && !slug.startsWith(ym)) continue;
    for (const [userId, s] of scoreChallenge(acs)) {
      const t = totals.get(userId) ?? { points: 0, solved: 0 };
      t.points += s.points;
      t.solved += 1;
      totals.set(userId, t);
    }
  }

  const out: LeaderRow[] = [...totals.entries()].map(([userId, t]) => ({
    rank: 0,
    username: usernameById.get(userId) ?? "unknown",
    points: t.points,
    solved: t.solved,
    flagged: false,
  }));
  out.sort((a, b) => b.points - a.points || (b.solved ?? 0) - (a.solved ?? 0));
  out.forEach((r, i) => (r.rank = i + 1));
  return out;
}
