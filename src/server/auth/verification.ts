import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { emailVerifications, users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { sendEmail, isConsoleTransport } from "@/server/email";

/**
 * Email OTP verification. Codes are 6 digits, hashed at rest (scrypt, same as
 * passwords), single active row per user, expiring in 10 minutes with a capped
 * number of attempts and a resend cooldown. Enforcement of "verified before you
 * can submit" is gated elsewhere by REQUIRE_EMAIL_VERIFICATION.
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

function sixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface CreateOtpResult {
  ok: boolean;
  error?: string;
  cooldownMs?: number;
  /** Present only under the dev console transport, so the UI can show the code. */
  devCode?: string;
}

/** Generates a fresh OTP for the user, stores its hash, and emails it. */
export async function createAndSendOtp(
  userId: string,
  email: string,
): Promise<CreateOtpResult> {
  const now = Date.now();

  const existing = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.userId, userId))
    .limit(1);
  if (existing[0] && now - existing[0].createdAt < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      error: "Please wait a moment before requesting another code.",
      cooldownMs: RESEND_COOLDOWN_MS - (now - existing[0].createdAt),
    };
  }

  const code = sixDigitCode();
  // One active row per user — replace any previous.
  await db
    .delete(emailVerifications)
    .where(eq(emailVerifications.userId, userId));
  await db.insert(emailVerifications).values({
    id: crypto.randomUUID(),
    userId,
    email,
    codeHash: hashPassword(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    createdAt: now,
  });

  const sent = await sendEmail({
    to: email,
    subject: "Your PESUECC Arena verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
  });
  if (!sent.ok) {
    return { ok: false, error: sent.error ?? "Could not send the email." };
  }

  return { ok: true, devCode: isConsoleTransport() ? code : undefined };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

/** Checks a submitted OTP, marking the user verified on success. */
export async function verifyOtp(
  userId: string,
  code: string,
): Promise<VerifyResult> {
  const now = Date.now();
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.userId, userId))
    .limit(1);
  const row = rows[0];

  if (!row) return { ok: false, error: "No pending code — request a new one." };
  if (now > row.expiresAt) {
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, userId));
    return { ok: false, error: "That code has expired — request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, userId));
    return { ok: false, error: "Too many attempts — request a new code." };
  }

  if (!verifyPassword(code, row.codeHash)) {
    await db
      .update(emailVerifications)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerifications.userId, userId));
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      error:
        left > 0
          ? `Incorrect code — ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many attempts — request a new code.",
    };
  }

  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  await db
    .delete(emailVerifications)
    .where(eq(emailVerifications.userId, userId));
  return { ok: true };
}
