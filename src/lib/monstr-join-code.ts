import crypto from "node:crypto";

// Crockford Base32 — avoids 0/O/1/I/L ambiguity
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;

/**
 * Generate a random 6-character join code using Crockford Base32.
 * Collision probability is extremely low for typical usage (30^6 ≈ 729M codes).
 */
export function generateJoinCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
