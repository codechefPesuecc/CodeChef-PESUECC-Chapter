import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
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

// A dummy hash (computed once, then cached) so the "no such user" path still spends
// the same PBKDF2 time as a real verify. Without it, a missing username returns
// faster than a wrong password, leaking which usernames exist — defense-in-depth on
// top of the login rate limit. Caches the promise so the derivation runs only once.
let dummyHashPromise: Promise<string> | null = null;
function timingEqualizer(): Promise<string> {
  return (dummyHashPromise ??= hashPassword("timing-equalizer-not-a-real-account"));
}

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
  // Always run verifyPassword (against the dummy hash when the user is missing)
  // so response timing doesn't reveal whether the username is registered.
  const stored = user?.passwordHash ?? (await timingEqualizer());
  const { ok: passwordOk, needsRehash } = await verifyPassword(password, stored);
  if (!user || !passwordOk) {
    return NextResponse.json(
      { ok: false, error: "Invalid username or password." },
      { status: 401 },
    );
  }

  // Transparently upgrade an older/weaker hash (legacy scrypt) now that we have the
  // plaintext. This is a silent rehash, not a credential change, so — unlike a
  // password reset — it must NOT bump sessionEpoch and invalidate the user's other sessions.
  if (needsRehash) {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, user.id));
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
      isAdmin: user.isAdmin,
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
