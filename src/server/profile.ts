import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { getChallengeBySlug } from "@/lib/challenges";
import { aggregateLeaderboard } from "@/server/leaderboard";

/**
 * Profile data for a signed-in user: their recorded (ranked) submission history
 * plus their standing on the aggregate boards. Only the current daily is ever
 * recorded, so this is the history of ranked attempts — practice solves on the
 * archive are intentionally not persisted.
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

  return rows.map((r) => ({
    ...r,
    title: getChallengeBySlug(r.slug)?.title ?? r.slug,
  }));
}

/** A user's points/rank/solved on the month and all-time boards. */
export async function getProfileStats(
  username: string,
  submissionCount: number,
): Promise<ProfileStats> {
  const [all, month] = await Promise.all([
    aggregateLeaderboard("all"),
    aggregateLeaderboard("month"),
  ]);
  const a = all.find((r) => r.username === username);
  const m = month.find((r) => r.username === username);
  return {
    allPoints: a?.points ?? 0,
    allRank: a?.rank ?? null,
    monthPoints: m?.points ?? 0,
    monthRank: m?.rank ?? null,
    solved: a?.solved ?? 0,
    submissions: submissionCount,
  };
}
