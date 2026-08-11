import crypto from "node:crypto";

/**
 * Stateless session tokens: an HMAC-SHA256-signed `userId:epoch:expiry` payload.
 * Kept dependency-free (only node:crypto) so it's unit-testable in isolation and
 * has no DB / next/headers imports.
 *
 * `epoch` is the user's `sessionEpoch`; it's bumped on password reset, so an old
 * token whose epoch no longer matches is rejected — a reset logs out every
 * existing session.
 */

/** 30 days, in seconds. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Insecure signing key used only outside production (dev/test convenience). */
const DEV_FALLBACK_SECRET = "dev-insecure-change-me-in-production";

// Read lazily (per call) rather than captured at module load: on Cloudflare
// Workers env vars/secrets are only reliably present in process.env within a
// request scope, so capturing at import time could silently use the dev fallback.
function secret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured !== DEV_FALLBACK_SECRET) return configured;
  // A missing (or still-default) secret in production would sign every session
  // with a key that's public in this repo — anyone could then forge a session
  // for any user. Fail loudly instead of silently using it.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is not set in production (or is still the dev default). Set " +
        "it as a Cloudflare Worker secret before deploying — see DEPLOY.md §5.",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sign(payload: string): string {
  const sig = crypto
    .createHmac("sha256", secret())
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
    crypto.createHmac("sha256", secret()).update(payload).digest("base64url"),
  );
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    return null;
  }
  return payload;
}

export interface SessionClaims {
  userId: string;
  /** Must match the user's current `sessionEpoch` (bumped on password reset). */
  epoch: number;
}

/** Signs a session token binding the user id to their current session epoch. */
export function createSessionToken(userId: string, epoch: number): string {
  const expiry = Date.now() + SESSION_MAX_AGE * 1000;
  return sign(`${userId}:${epoch}:${expiry}`);
}

/** Verifies + parses a session token (signature, structure, and expiry). */
export function readSessionToken(token: string): SessionClaims | null {
  const payload = unsign(token);
  if (!payload) return null;
  // userId is a UUID (no colons), so exactly three parts.
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [userId, epochStr, expiryStr] = parts;
  const epoch = Number(epochStr);
  const expiry = Number(expiryStr);
  if (!userId || !Number.isFinite(epoch) || !Number.isFinite(expiry)) return null;
  if (Date.now() > expiry) return null;
  return { userId, epoch };
}
