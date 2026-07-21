import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Stateless sessions: a `userId:expiry` payload signed with HMAC-SHA256 and
 * stored in an httpOnly cookie. No DB session table; the signature is the proof.
 * Set `AUTH_SECRET` in production — the dev fallback is intentionally insecure.
 */

export const SESSION_COOKIE = "arena_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)

const SECRET =
  process.env.AUTH_SECRET ?? "dev-insecure-change-me-in-production";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  srn: string | null;
  prn: string;
  createdAt: number;
}

function sign(payload: string): string {
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function unsign(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(
    crypto.createHmac("sha256", SECRET).update(payload).digest("base64url"),
  );
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    return null;
  }
  return payload;
}

export function createSessionToken(userId: string): string {
  const expiry = Date.now() + SESSION_MAX_AGE * 1000;
  return sign(`${userId}:${expiry}`);
}

export function readSessionToken(token: string): string | null {
  const payload = unsign(token);
  if (!payload) return null;
  const [userId, expiryStr] = payload.split(":");
  const expiry = Number(expiryStr);
  if (!userId || !Number.isFinite(expiry) || Date.now() > expiry) return null;
  return userId;
}

/** The signed-in user, read from the session cookie (or null). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = readSessionToken(token);
  if (!userId) return null;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    srn: user.srn,
    prn: user.prn,
    createdAt: user.createdAt,
  };
}
