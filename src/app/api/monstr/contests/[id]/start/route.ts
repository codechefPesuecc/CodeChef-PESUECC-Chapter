import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getTeacherUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Start a Monstr contest — set startedAt and compute endsAt.
 * Idempotent: calling twice is safe.
 */
export async function PATCH(
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

    // Get contest and verify ownership
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
    if (contest.teacherId !== teacher.id) {
      return NextResponse.json(
        { ok: false, error: "Not authorized." },
        { status: 403 },
      );
    }

    // If already started, return current times (idempotent)
    if (contest.startedAt) {
      return NextResponse.json({
        ok: true,
        startedAt: contest.startedAt,
        endsAt: contest.endsAt,
      });
    }

    // Start the contest
    const now = Date.now();
    const endsAt = now + contest.durationMinutes * 60 * 1000;

    await db
      .update(monstrContests)
      .set({ startedAt: now, endsAt })
      .where(eq(monstrContests.id, id));

    return NextResponse.json({
      ok: true,
      startedAt: now,
      endsAt,
    });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/start] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to start contest." },
      { status: 500 },
    );
  }
}
