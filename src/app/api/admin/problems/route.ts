import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { challenges } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { AdminChallengeSchema } from "@/lib/challenge-schema";
import { toChallengeRow } from "@/lib/challenge-persist";
import { isDateTaken } from "@/lib/challenges";

export const dynamic = "force-dynamic";

/** POST /api/admin/problems — create a new CP Arena problem (admins only). */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

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

  const db = getDb();
  const existing = await db
    .select({ slug: challenges.slug })
    .from(challenges)
    .where(eq(challenges.slug, input.slug))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { ok: false, error: `A problem with slug "${input.slug}" already exists.` },
      { status: 409 },
    );
  }

  // One Problem of the Day per date (pool problems have no date and are exempt).
  if (input.date && (await isDateTaken(input.date))) {
    return NextResponse.json(
      { ok: false, error: `${input.date} already has a Problem of the Day scheduled.` },
      { status: 409 },
    );
  }

  const now = Date.now();
  const row = await toChallengeRow(input, { createdAt: now, updatedAt: now });
  await db.insert(challenges).values(row);

  return NextResponse.json({ ok: true, slug: input.slug });
}
