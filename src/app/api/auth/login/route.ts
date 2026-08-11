import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
} from "@/server/auth/session";

export const dynamic = "force-dynamic";

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
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Enter your username and password." },
      { status: 400 },
    );
  }

  // Throttle password guessing: tight per-account, looser per-IP (campus NAT).
  const limited = await enforceRateLimits([
    [`login:user:${username}`, 10, 5 * 60_000],
    [`login:ip:${clientIp(req)}`, 50, 5 * 60_000],
  ]);
  if (limited) return limited;

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: "Invalid username or password." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      srn: user.srn,
      prn: user.prn,
      createdAt: user.createdAt,
    },
  });
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken(user.id, user.sessionEpoch),
    cookieOptions,
  );
  return res;
}
