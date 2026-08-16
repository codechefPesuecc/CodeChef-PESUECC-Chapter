import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { emailVerifications, users } from "@/server/db/schema";
import { sendEmail, canRevealSecretInResponse } from "@/server/email";
import { otpEmailHtml } from "@/server/emailTemplates";

/**
 * Email OTP verification. Codes are 6 digits, hashed at rest with a fast salted
 * SHA-256 (stored as `sha256$<salt>$<hash>`), single active row per user, expiring
 * in 10 minutes with a capped number of attempts and a resend cooldown. A short-lived,
 * attempt-limited 6-digit code doesn't warrant a slow password KDF — the rate limit and
 * expiry are the real defense. Enforcement of "verified before you can submit" is gated
 * elsewhere by REQUIRE_EMAIL_VERIFICATION.
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

function sixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// OTP hashing: salted SHA-256, stored as `sha256$<saltHex>$<hashHex>`. Fast (no KDF)
// because the code space is tiny and short-lived; the resend cooldown + attempt cap
// are the guard, not hash slowness. Verification is constant-time.
function hashOtp(code: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.createHash("sha256").update(salt).update(code, "utf8").digest();
  return `sha256$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyOtpHash(code: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const test = crypto.createHash("sha256").update(salt).update(code, "utf8").digest();
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
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
  const db = getDb();

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
    codeHash: hashOtp(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    createdAt: now,
  });

  const sent = await sendEmail({
    to: email,
    subject: "Your CodeChef PESUECC Arena verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.\n\n— CodeChef PESUECC Chapter`,
    html: otpEmailHtml(code),
  });
  if (!sent.ok) {
    return { ok: false, error: sent.error ?? "Could not send the email." };
  }

  return { ok: true, devCode: canRevealSecretInResponse() ? code : undefined };
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
  const db = getDb();
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

  // A row hashed by the previous scheme (pre-PBKDF2 deploy) can't match the new
  // verifier — expire it instead of burning an attempt on it.
  if (!row.codeHash.startsWith("sha256$")) {
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, userId));
    return { ok: false, error: "That code has expired — request a new one." };
  }

  if (!verifyOtpHash(code, row.codeHash)) {
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
