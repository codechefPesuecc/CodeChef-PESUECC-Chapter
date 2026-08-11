import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import {
  SESSION_MAX_AGE,
  createSessionToken,
  readSessionToken,
} from "@/server/auth/token";

/**
 * Stateless sessions: a signed `userId:epoch:expiry` payload in an httpOnly
 * cookie. No DB session table — the HMAC signature is the proof, and the epoch
 * (compared to the user's `sessionEpoch` below) lets a password reset revoke
 * every outstanding session. Token signing/verification lives in ./token.ts.
 */

export const SESSION_COOKIE = "arena_session";

// Re-exported so existing importers (login/register routes) keep working.
export { SESSION_MAX_AGE, createSessionToken, readSessionToken };

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  srn: string | null;
  prn: string;
  createdAt: number;
}

/** The signed-in user, read from the session cookie (or null). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = readSessionToken(token);
  if (!claims) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  // Reject any session issued before the user's last password reset.
  if (user.sessionEpoch !== claims.epoch) return null;
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
