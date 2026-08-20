import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests, monstrProblems, monstrParticipants } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Get contest status for a student — used by the workspace for polling.
 * Returns contest info, problem list, and server time for clock sync.
 * MUST verify participant (not just authentication).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  try {
    const db = getDb();

    // Verify participant is joined - required for all contest data access
    const participantRows = await db
      .select()
      .from(monstrParticipants)
      .where(
        and(
          eq(monstrParticipants.contestId, id),
          eq(monstrParticipants.userId, user.id),
        ),
      )
      .limit(1);

    if (!participantRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Not joined." },
        { status: 403 },
      );
    }

    // Get contest
    const contestRows = await db
      .select()
      .from(monstrContests)
      .where(eq(monstrContests.id, id))
      .limit(1);

    if (!contestRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Contest not found." },
        { status: 404 },
      );
    }

    const contest = contestRows[0];

    // Get problems sorted by teacher-defined orderIndex
    const problems = await db
      .select({
        id: monstrProblems.id,
        title: monstrProblems.title,
        orderIndex: monstrProblems.orderIndex,
      })
      .from(monstrProblems)
      .where(eq(monstrProblems.contestId, id))
      .orderBy(asc(monstrProblems.orderIndex));

    const allowedLanguages = JSON.parse(contest.allowedLanguages);
    const now = Date.now();

    return NextResponse.json({
      ok: true,
      title: contest.title,
      startedAt: contest.startedAt,
      endsAt: contest.endsAt,
      serverNow: now,
      problems,
      allowedLanguages,
    });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/status] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch status." },
      { status: 500 },
    );
  }
}
