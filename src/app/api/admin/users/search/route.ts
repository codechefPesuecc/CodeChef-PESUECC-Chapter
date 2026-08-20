import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { or, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Admin endpoint to search for users by username, name, or email.
 */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Admin access required." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { ok: false, error: "Query must be at least 2 characters." },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const searchTerm = `%${query}%`;

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(
        or(
          like(users.username, searchTerm),
          like(users.name, searchTerm),
          like(users.email, searchTerm),
        ),
      )
      .limit(20);

    return NextResponse.json({ ok: true, users: results });
  } catch (error) {
    console.error("[api/admin/users/search] error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
