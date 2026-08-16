import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { submissions, users, challenges } from "@/server/db/schema";
import { getDailyChallenge, istYearMonth } from "@/lib/challenges";
import { scoreChallenge, type ScoreInput } from "@/lib/scoring";

/**
 * Leaderboards derived from persisted submissions (the scoring rules live in
 * `@/lib/scoring`). Today's Problem of the Day ranks live solves by finish order —
 * the server timestamp of the first Accepted submission, so it can't be spoofed —
 * and freezes on its own at IST midnight once a newer problem becomes the POTD.
 * Solving a past problem earns a flat base score.
 */

export interface LeaderRow {
  rank: number | null; // null = flagged / out of the ranked positions
  // Public board identity: SRN if the student has one, else PRN. The login handle
  // (username) and email are intentionally not exposed on the board.
  display: string;
  points: number;
  flagged: boolean;
  solved?: number; // month / all-time
  language?: string; // today
  timeSeconds?: number | null; // today (server-computed solve duration)
}

/** Today's problem: finish-order standings with the speed-bounty points. Only
 * live (ranked) accepted solves count — a past-problem practice solve of the same
 * slug never appears here. */
export async function todayLeaderboard(): Promise<LeaderRow[]> {
  const daily = await getDailyChallenge();
  if (!daily) return [];

  const db = getDb();
  const rows = await db
    .select({
      userId: submissions.userId,
      createdAt: submissions.createdAt,
      flags: submissions.flags,
      elapsedSeconds: submissions.elapsedSeconds,
      language: submissions.language,
      srn: users.srn,
      prn: users.prn,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .where(
      and(
        eq(submissions.challengeSlug, daily.slug),
        eq(submissions.status, "AC"),
        eq(submissions.ranked, true),
      ),
    );

  const displayById = new Map(rows.map((r) => [r.userId, r.srn ?? r.prn]));
  // Earliest live AC per user carries the language + solve time we display.
  const firstByUser = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = firstByUser.get(r.userId);
    if (!cur || r.createdAt < cur.createdAt) firstByUser.set(r.userId, r);
  }

  const scored = scoreChallenge(
    rows.map((r) => ({
      userId: r.userId,
      createdAt: r.createdAt,
      flags: r.flags,
      ranked: true,
    })),
  );

  const out: LeaderRow[] = [...scored.entries()].map(([userId, s]) => {
    const first = firstByUser.get(userId);
    return {
      rank: s.rank,
      display: displayById.get(userId) ?? "unknown",
      points: s.points,
      flagged: s.flagged,
      language: first?.language,
      timeSeconds: first?.elapsedSeconds ?? null,
    };
  });
  out.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return out;
}

// Cached snapshot of every accepted submission joined to its challenge date and the
// user's board identity. The month and all-time boards — and every profile page —
// derive from this same set, so it's fetched once per isolate per TTL instead of
// re-scanning D1 on every request (the scan grows with submission volume). A global
// board tolerates brief staleness; today's live board is computed separately and is
// never cached. `caches.default` isn't available under `next dev`, so a plain
// module-level cache is used (per-isolate, which is sufficient here).
const AGGREGATE_TTL_MS = 30_000;

function fetchAggregateRows() {
  const db = getDb();
  return db
    .select({
      userId: submissions.userId,
      challengeSlug: submissions.challengeSlug,
      createdAt: submissions.createdAt,
      flags: submissions.flags,
      ranked: submissions.ranked,
      date: challenges.date,
      srn: users.srn,
      prn: users.prn,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .innerJoin(challenges, eq(submissions.challengeSlug, challenges.slug))
    .where(eq(submissions.status, "AC"));
}

type AggregateRow = Awaited<ReturnType<typeof fetchAggregateRows>>[number];
let aggregateCache: { rows: AggregateRow[]; at: number } | null = null;

async function getAggregateRows(): Promise<AggregateRow[]> {
  const now = Date.now();
  if (aggregateCache && now - aggregateCache.at < AGGREGATE_TTL_MS) {
    return aggregateCache.rows;
  }
  const rows = await fetchAggregateRows();
  aggregateCache = { rows, at: now };
  return rows;
}

/**
 * Month / all-time: sum of each user's per-challenge award. Live solvers get their
 * speed-bounty points; late (practice) solvers get the flat base score. Month uses
 * each challenge's own IST date, compared against the current IST month. Derived from
 * a short-lived cached snapshot of accepted submissions (see getAggregateRows).
 */
export async function aggregateLeaderboard(scope: "month" | "all"): Promise<LeaderRow[]> {
  const rows = await getAggregateRows();

  const displayById = new Map(rows.map((r) => [r.userId, r.srn ?? r.prn]));

  const bySlug = new Map<string, { date: string; acs: ScoreInput[] }>();
  for (const r of rows) {
    const group = bySlug.get(r.challengeSlug) ?? { date: r.date, acs: [] };
    group.acs.push({
      userId: r.userId,
      createdAt: r.createdAt,
      flags: r.flags,
      ranked: r.ranked,
    });
    bySlug.set(r.challengeSlug, group);
  }

  const ym = istYearMonth();
  const totals = new Map<string, { points: number; solved: number }>();
  for (const [, group] of bySlug) {
    if (scope === "month" && !group.date.startsWith(ym)) continue;
    for (const [userId, s] of scoreChallenge(group.acs)) {
      const t = totals.get(userId) ?? { points: 0, solved: 0 };
      t.points += s.points;
      t.solved += 1;
      totals.set(userId, t);
    }
  }

  const out: LeaderRow[] = [...totals.entries()].map(([userId, t]) => ({
    rank: 0,
    display: displayById.get(userId) ?? "unknown",
    points: t.points,
    solved: t.solved,
    flagged: false,
  }));
  out.sort((a, b) => b.points - a.points || (b.solved ?? 0) - (a.solved ?? 0));
  out.forEach((r, i) => (r.rank = i + 1));
  return out;
}
