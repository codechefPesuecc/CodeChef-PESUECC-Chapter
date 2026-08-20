import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * Admin endpoint to promote/demote users to teacher.
 * Only accessible to admins.
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Admin access required." },
      { status: 403 },
    );
  }

  let body: { userId?: string; isTeacher?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { userId, isTeacher } = body;
  if (!userId || typeof isTeacher !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "userId and isTeacher are required." },
      { status: 400 },
    );
  }

  try {
    const db = getDb();

    // Verify user exists
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRows[0]) {
      return NextResponse.json(
        { ok: false, error: "User not found." },
        { status: 404 },
      );
    }

    // Update isTeacher flag
    await db.update(users).set({ isTeacher }).where(eq(users.id, userId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/teachers] error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
