import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getTeacherUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import {
  monstrContests,
  monstrParticipants,
  monstrSubmissions,
  monstrProblems,
  users,
} from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Get all participants with their submission data (best verdict per problem).
 * Teacher-only endpoint.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teacher = await getTeacherUser();
  if (!teacher) {
    return NextResponse.json(
      { ok: false, error: "Teacher access required." },
      { status: 403 },
    );
  }

  try {
    const db = getDb();

    // Verify ownership
    const contestRows = await db
      .select()
      .from(monstrContests)
      .where(eq(monstrContests.id, id))
      .limit(1);

    if (!contestRows[0] || contestRows[0].teacherId !== teacher.id) {
      return NextResponse.json(
        { ok: false, error: "Not authorized." },
        { status: 403 },
      );
    }

    // Get all participants
    const participants = await db
      .select({
        userId: monstrParticipants.userId,
        username: users.username,
        name: users.name,
        srn: users.srn,
      })
      .from(monstrParticipants)
      .innerJoin(users, eq(monstrParticipants.userId, users.id))
      .where(eq(monstrParticipants.contestId, id));

    // Get all problems, sorted by order
    const problems = await db
      .select()
      .from(monstrProblems)
      .where(eq(monstrProblems.contestId, id))
      .orderBy(monstrProblems.orderIndex);

    const problemIds = problems.map((p) => p.id);

    // Get all submissions
    const submissions = await db
      .select()
      .from(monstrSubmissions)
      .where(eq(monstrSubmissions.contestId, id));

    // Build result
    const result = participants.map((p) => {
      const problemsData = problemIds.map((problemId) => {
        const subs = submissions.filter(
          (s) => s.userId === p.userId && s.problemId === problemId,
        );

        // Get best verdict (prefer AC verdict if exists, else latest by createdAt)
        let bestVerdictSub = null;
        if (subs.length > 0) {
          const acSub = subs.find((s) => s.status === "AC");
          if (acSub) {
            bestVerdictSub = acSub;
          } else {
            // Sort by createdAt descending and take the first (latest)
            bestVerdictSub = subs.reduce((latest, sub) =>
              (sub.createdAt > latest.createdAt) ? sub : latest
            );
          }
        }

        return {
          problemId,
          bestStatus: bestVerdictSub?.status ?? "—",
          submissionCount: subs.length,
        };
      });

      const problemsSolved = problemsData.filter(
        (p) => p.bestStatus === "AC",
      ).length;

      return {
        userId: p.userId,
        username: p.username,
        name: p.name,
        srn: p.srn,
        problemsSolved,
        problems: problemsData,
      };
    });

    return NextResponse.json({
      ok: true,
      participants: result,
      problemIds,
    });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/participants] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch participants." },
      { status: 500 },
    );
  }
}
