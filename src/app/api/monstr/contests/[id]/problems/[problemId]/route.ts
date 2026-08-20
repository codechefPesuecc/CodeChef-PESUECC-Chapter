import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrProblems, monstrParticipants, monstrContests } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Get problem details for a student — public fields only (no tests/checker).
 * Contest must be started.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; problemId: string }> }
) {
  const { id, problemId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  try {
    const db = getDb();

    // Verify participant
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

    // Check contest is started
    const contestRows = await db
      .select()
      .from(monstrContests)
      .where(eq(monstrContests.id, id))
      .limit(1);

    if (!contestRows[0] || !contestRows[0].startedAt) {
      return NextResponse.json(
        { ok: false, error: "Contest not started." },
        { status: 403 },
      );
    }

    // Get problem (public fields only)
    const problems = await db
      .select({
        id: monstrProblems.id,
        title: monstrProblems.title,
        statement: monstrProblems.statement,
        inputFormat: monstrProblems.inputFormat,
        outputFormat: monstrProblems.outputFormat,
        constraints: monstrProblems.constraints,
        samples: monstrProblems.samples,
        contentHtml: monstrProblems.contentHtml,
        timeLimit: monstrProblems.timeLimit,
        memoryLimit: monstrProblems.memoryLimit,
      })
      .from(monstrProblems)
      .where(
        and(
          eq(monstrProblems.id, problemId),
          eq(monstrProblems.contestId, id),
        ),
      )
      .limit(1);

    if (!problems[0]) {
      return NextResponse.json(
        { ok: false, error: "Problem not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, ...problems[0] });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/problems/[problemId]] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch problem." },
      { status: 500 },
    );
  }
}
