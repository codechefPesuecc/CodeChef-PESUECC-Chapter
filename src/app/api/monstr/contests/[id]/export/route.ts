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
import { generateContestExcel } from "@/lib/monstr-excel-export";

export const dynamic = "force-dynamic";

/**
 * Export contest results as Excel file.
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

    const contest = contestRows[0];

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

    // Build results for Excel
    const results = participants.map((p) => {
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

        const problem = problems.find((pr) => pr.id === problemId);

        return {
          problemId,
          problemTitle: problem?.title ?? "Unknown",
          bestStatus: bestVerdictSub?.status ?? "—",
          submissionCount: subs.length,
        };
      });

      const problemsSolved = problemsData.filter(
        (p) => p.bestStatus === "AC",
      ).length;

      return {
        username: p.username,
        name: p.name || "",
        srn: p.srn || "",
        problemsSolved,
        submissions: problemsData,
      };
    });

    // Generate Excel
    const buffer = generateContestExcel({
      problems,
      results,
    });

    // Return as Excel file
    // Sanitize filename to prevent header injection
    const sanitizedTitle = contest.title
      .replace(/[^a-zA-Z0-9_\-]/g, "-")
      .replace(/-+/g, "-");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizedTitle}-results.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/export] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to export results." },
      { status: 500 },
    );
  }
}
