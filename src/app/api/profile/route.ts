import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { rateLimit } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Edit the signed-in user's profile. Only display fields are editable here —
 * name and username. Identity fields (SRN / PRN / email) are intentionally not
 * editable: SRN/PRN are the unique student identity and the leaderboard handle,
 * and changing email would need re-verification.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in first.", needsAuth: true },
      { status: 401 },
    );
  }

  const limit = await rateLimit(`profile:user:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many changes — slow down.", rateLimited: true },
      { status: 429 },
    );
  }

  let body: { name?: unknown; username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const updates: { name?: string; username?: string } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json(
        { ok: false, error: "Name must be 1–80 characters." },
        { status: 400 },
      );
    }
    updates.name = name;
  }

  const db = getDb();

  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { ok: false, error: "Username must be 3–20 characters: letters, numbers, underscore." },
        { status: 400 },
      );
    }
    if (username !== user.username) {
      const clash = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, user.id)))
        .limit(1);
      if (clash.length) {
        return NextResponse.json({ ok: false, error: "That username is taken." }, { status: 409 });
      }
      updates.username = username;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  try {
    await db.update(users).set(updates).where(eq(users.id, user.id));
  } catch (e) {
    console.error("[profile] update failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn't save changes." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...updates });
}
