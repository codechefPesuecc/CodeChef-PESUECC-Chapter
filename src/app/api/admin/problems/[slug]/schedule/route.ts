import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { challenges } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { getChallengeForAdmin, isDateTaken, todayStr } from "@/lib/challenges";
import { isRealDate } from "@/lib/challenge-schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/problems/[slug]/schedule — assign or clear a problem's Problem-of-
 * the-Day date (admins only). Body: { date: "YYYY-MM-DD" | null }.
 *  - date set  → schedules it for that IST day (must be today or later, and free).
 *  - date null → moves it back to the pool (only allowed if it isn't already past).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const { slug } = await params;
  let body: { date?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const challenge = await getChallengeForAdmin(slug);
  if (!challenge) {
    return NextResponse.json({ ok: false, error: "No such problem." }, { status: 404 });
  }

  const today = todayStr();
  const raw = body.date;

  // Clear → back to the pool.
  if (raw === null || raw === undefined || raw === "") {
    if (challenge.date != null && challenge.date < today) {
      return NextResponse.json(
        { ok: false, error: "This problem has already been live; past problems can't return to the pool." },
        { status: 409 },
      );
    }
    await setDate(slug, null);
    return NextResponse.json({ ok: true, date: null });
  }

  // Assign a date.
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || !isRealDate(raw)) {
    return NextResponse.json(
      { ok: false, error: "date must be a real YYYY-MM-DD calendar date." },
      { status: 400 },
    );
  }
  if (raw < today) {
    return NextResponse.json(
      { ok: false, error: "Can't schedule a Problem of the Day in the past." },
      { status: 400 },
    );
  }
  if (await isDateTaken(raw, slug)) {
    return NextResponse.json(
      { ok: false, error: `${raw} already has a Problem of the Day scheduled.` },
      { status: 409 },
    );
  }

  await setDate(slug, raw);
  return NextResponse.json({ ok: true, date: raw });
}

async function setDate(slug: string, date: string | null): Promise<void> {
  const db = getDb();
  await db
    .update(challenges)
    .set({ date, updatedAt: Date.now() })
    .where(eq(challenges.slug, slug));
}
