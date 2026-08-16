import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { submissions } from "@/server/db/schema";

/**
 * Whether a user has a live (ranked) accepted solve for a problem. Backs both the
 * hide-after-solve gate on the solve page and the one-solve guard in the submit
 * route, so the two can't disagree.
 */
export async function hasSolvedRanked(
  userId: string,
  slug: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, userId),
        eq(submissions.challengeSlug, slug),
        eq(submissions.status, "AC"),
        eq(submissions.ranked, true),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
