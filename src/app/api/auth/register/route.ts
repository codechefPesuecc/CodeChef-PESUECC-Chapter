import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  type SessionUser,
} from "@/server/auth/session";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const prn = String(body.prn ?? "").trim().toUpperCase();
  const srn = body.srn ? String(body.srn).trim().toUpperCase() : null;
  const password = String(body.password ?? "");

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { ok: false, error: "Username must be 3–20 characters: letters, numbers, underscore." },
      { status: 400 },
    );
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

  const conditions = [eq(users.username, username), eq(users.email, email), eq(users.prn, prn)];
  if (srn) conditions.push(eq(users.srn, srn));
  const clashes = await db.select().from(users).where(or(...conditions));
  if (clashes.length > 0) {
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
  const createdAt = Date.now();
  try {
    await db.insert(users).values({
      id,
      username,
      email,
      srn,
      prn,
      passwordHash: hashPassword(password),
      createdAt,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "An account with those details already exists." },
      { status: 409 },
    );
  }

  const user: SessionUser = {
    id,
    username,
    email,
    emailVerified: false,
    srn,
    prn,
    createdAt,
  };
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE, createSessionToken(id), cookieOptions);
  return res;
}
