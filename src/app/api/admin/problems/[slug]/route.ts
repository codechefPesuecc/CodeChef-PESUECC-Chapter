import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { challenges } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { AdminChallengeSchema } from "@/lib/challenge-schema";
import { toChallengeRow } from "@/lib/challenge-persist";
import { isDateTaken } from "@/lib/challenges";

export const dynamic = "force-dynamic";

/** PUT /api/admin/problems/[slug] — edit an existing problem (admins only). The slug
 * is immutable: renaming would orphan every submission that references the old slug,
 * so the URL slug is authoritative and a mismatched body slug is rejected. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = AdminChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.slug !== slug) {
    return NextResponse.json(
      { ok: false, error: "The slug can't be changed when editing a problem." },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db
    .select({ createdAt: challenges.createdAt })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ ok: false, error: "No such problem." }, { status: 404 });
  }

  // One Problem of the Day per date; allow keeping this problem's own date.
  if (input.date && (await isDateTaken(input.date, slug))) {
    return NextResponse.json(
      { ok: false, error: `${input.date} already has a Problem of the Day scheduled.` },
      { status: 409 },
    );
  }

  const row = await toChallengeRow(input, {
    createdAt: existing[0].createdAt,
    updatedAt: Date.now(),
  });
  await db.update(challenges).set(row).where(eq(challenges.slug, slug));

  return NextResponse.json({ ok: true, slug });
}

/** DELETE /api/admin/problems/[slug] — remove a problem (admins only). Submissions
 * are NOT cascaded (there's no FK); the caller is warned that a challenge's recorded
 * solves drop out of the aggregate boards once it's gone. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const { slug } = await params;

  const db = getDb();
  const existing = await db
    .select({ slug: challenges.slug })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ ok: false, error: "No such problem." }, { status: 404 });
  }

  await db.delete(challenges).where(eq(challenges.slug, slug));
  return NextResponse.json({ ok: true });
}
