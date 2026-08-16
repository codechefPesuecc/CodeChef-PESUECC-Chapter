import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { getChallengeTitles } from "@/lib/challenges";
import { aggregateLeaderboard } from "@/server/leaderboard";

/**
 * Profile data for a signed-in user: their recorded submission history plus their
 * standing on the aggregate boards. Ranked (live Problem-of-the-Day) submissions
 * are recorded in full; accepted practice solves on past problems are also kept
 * (they earn the flat base score).
 */

export interface ProfileSubmission {
  id: string;
  slug: string;
  title: string;
  language: string;
  status: string;
  elapsedSeconds: number | null;
  flags: number;
  createdAt: number;
}

export interface ProfileStats {
  allPoints: number;
  allRank: number | null;
  monthPoints: number;
  monthRank: number | null;
  solved: number;
  submissions: number;
}

/** Every recorded submission for a user, newest first. */
export async function getUserSubmissions(
  userId: string,
): Promise<ProfileSubmission[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: submissions.id,
      slug: submissions.challengeSlug,
      language: submissions.language,
      status: submissions.status,
      elapsedSeconds: submissions.elapsedSeconds,
      flags: submissions.flags,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt));

  // One batched title lookup instead of a per-row query.
  const titles = await getChallengeTitles([...new Set(rows.map((r) => r.slug))]);
  return rows.map((r) => ({
    ...r,
    title: titles.get(r.slug) ?? r.slug,
  }));
}

/** A user's points/rank/solved on the month and all-time boards. */
export async function getProfileStats(
  identity: string,
  submissionCount: number,
): Promise<ProfileStats> {
  const [all, month] = await Promise.all([
    aggregateLeaderboard("all"),
    aggregateLeaderboard("month"),
  ]);
  // The boards are keyed by SRN-else-PRN; match on that identity.
  const a = all.find((r) => r.display === identity);
  const m = month.find((r) => r.display === identity);
  return {
    allPoints: a?.points ?? 0,
    allRank: a?.rank ?? null,
    monthPoints: m?.points ?? 0,
    monthRank: m?.rank ?? null,
    solved: a?.solved ?? 0,
    submissions: submissionCount,
  };
}
