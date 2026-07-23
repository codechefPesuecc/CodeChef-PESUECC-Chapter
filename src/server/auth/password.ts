import crypto from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt — no third-party dependency.
 * Stored as `salt:hash` (both hex). Verification is constant-time.
 */
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === test.length && crypto.timingSafeEqual(expected, test)
  );
}
