import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { passwordResets, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { sendEmail, isConsoleTransport } from "@/server/email";

/**
 * Password reset via a single-use emailed link. The token is a 256-bit random
 * value; only its SHA-256 hash is stored, so a DB read can't reset anyone. One
 * active token per user, 30-minute expiry, consumed on use.
 */

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface ForgotResult {
  ok: boolean;
  /** Present only under the dev console transport, so testing needs no inbox. */
  devLink?: string;
}

/**
 * Issues a reset token for the email (if it maps to an account) and emails the
 * link. Always resolves ok — it never reveals whether an account exists.
 */
export async function createPasswordReset(
  email: string,
  origin: string,
): Promise<ForgotResult> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];
  if (!user) return { ok: true };

  const now = Date.now();
  const token = crypto.randomBytes(32).toString("base64url");
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
  await db.insert(passwordResets).values({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: now + RESET_TTL_MS,
    createdAt: now,
  });

  const link = `${origin}/reset?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Reset your PESUECC Arena password",
    text: `Reset your password with this link (valid for 30 minutes):\n\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
  });

  return { ok: true, devLink: isConsoleTransport() ? link : undefined };
}

export interface ResetResult {
  ok: boolean;
  error?: string;
}

/** Consumes a reset token and sets the new password. */
export async function resetPassword(
  token: string,
  password: string,
): Promise<ResetResult> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const now = Date.now();
  const rows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return { ok: false, error: "This reset link is invalid or already used." };
  }
  if (now > row.expiresAt) {
    await db.delete(passwordResets).where(eq(passwordResets.id, row.id));
    return { ok: false, error: "This reset link has expired — request a new one." };
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(users.id, row.userId));
  await db
    .delete(passwordResets)
    .where(eq(passwordResets.userId, row.userId));
  return { ok: true };
}
