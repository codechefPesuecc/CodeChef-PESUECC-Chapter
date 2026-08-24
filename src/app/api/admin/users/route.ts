import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { listAllUsers } from "@/server/admin/users";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/admin/users?q= — list or search all users (admins only). */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const rows = await listAllUsers(q);
  return NextResponse.json({ ok: true, users: rows });
}

/**
 * POST /api/admin/users — create a user directly (admins only). Admin-created
 * accounts are pre-verified (no OTP) and may be granted admin/teacher on creation.
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const prn = String(body.prn ?? "").trim().toUpperCase();
  const srn = body.srn ? String(body.srn).trim().toUpperCase() : null;
  const password = String(body.password ?? "");
  const isAdmin = body.isAdmin === true;
  const isTeacher = body.isTeacher === true;

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { ok: false, error: "Username must be 3–20 chars: lowercase letters, numbers, underscore." },
      { status: 400 },
    );
  }
  if (name && name.length > 80) {
    return NextResponse.json({ ok: false, error: "Name is too long (max 80)." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!prn) {
    return NextResponse.json({ ok: false, error: "PRN is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const db = getDb();
  const conditions = [eq(users.username, username), eq(users.email, email), eq(users.prn, prn)];
  if (srn) conditions.push(eq(users.srn, srn));
  const clashes = await db.select().from(users).where(or(...conditions));
  if (clashes[0]) {
    const c = clashes[0];
    const error =
      c.username === username
        ? "That username is taken."
        : c.email === email
          ? "An account with that email already exists."
          : c.prn === prn
            ? "An account with that PRN already exists."
            : "An account with that SRN already exists.";
    return NextResponse.json({ ok: false, error }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await db.insert(users).values({
      id,
      username,
      name: name || null,
      email,
      emailVerified: true,
      srn,
      prn,
      passwordHash,
      isAdmin,
      isTeacher,
      createdAt: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "An account with those details already exists." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, id });
}
