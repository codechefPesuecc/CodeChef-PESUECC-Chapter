import crypto from "node:crypto";

/**
 * Password hashing with WebCrypto PBKDF2-HMAC-SHA256.
 *
 * New hashes are stored as `pbkdf2$<iterations>$<saltHex>$<hashHex>`. PBKDF2 via
 * `crypto.subtle` runs natively on the Workers runtime and — unlike scrypt — needs
 * no large scratch buffer, so it doesn't push the isolate toward its memory limit.
 *
 * Legacy hashes (the old scrypt `saltHex:hashHex` form) still verify, and
 * `verifyPassword` reports `needsRehash` so the login route can transparently
 * upgrade them to PBKDF2 on the next successful sign-in. Verification is
 * constant-time.
 */

// PBKDF2-HMAC-SHA256, 100k iterations, 32-byte (one SHA-256 block) output. 100,000 is
// the Cloudflare Workers cap: the PRODUCTION runtime rejects `deriveBits` above it
// ("Pbkdf2 failed: iteration counts above 100000 are not supported"), even though a
// local `wrangler dev` happily allows more — and that exact local-vs-prod divergence
// broke production login once already. DO NOT raise this above 100000. Output stays at
// one SHA-256 block (deriving more multiplies the defender's cost per byte for free).
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;
const SALT_BYTES = 16;
// Key length the old scrypt hashes were derived with — needed to verify them.
const LEGACY_SCRYPT_KEYLEN = 64;

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Buffer> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    // Copy into a fresh ArrayBuffer-backed view so the type is BufferSource (a
    // plain Uint8Array is generic over ArrayBufferLike, which includes SharedArrayBuffer).
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations },
    key,
    PBKDF2_KEYLEN * 8,
  );
  return Buffer.from(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export interface VerifyResult {
  /** Whether the password matched the stored hash. */
  ok: boolean;
  /**
   * True when `ok` and the stored hash is an older/weaker form (legacy scrypt, or
   * PBKDF2 below the current iteration count) — the caller should re-hash and persist.
   */
  needsRehash: boolean;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<VerifyResult> {
  if (stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return { ok: false, needsRehash: false };
    const iterations = Number(parts[1]);
    const salt = Buffer.from(parts[2], "hex");
    const expected = Buffer.from(parts[3], "hex");
    if (
      !Number.isInteger(iterations) ||
      iterations <= 0 ||
      salt.length === 0 ||
      expected.length === 0
    ) {
      return { ok: false, needsRehash: false };
    }
    let test: Buffer;
    try {
      test = await pbkdf2(password, salt, iterations);
    } catch (err) {
      // A stored hash whose iteration count the runtime rejects (e.g. a legacy
      // pbkdf2$210000$ row created before this prod-cap fix) can't be verified — fail
      // closed instead of throwing a 500. Logged so it surfaces in `wrangler tail`.
      console.error("verifyPassword: PBKDF2 derive failed:", err);
      return { ok: false, needsRehash: false };
    }
    const ok =
      expected.length === test.length && crypto.timingSafeEqual(expected, test);
    return { ok, needsRehash: ok && iterations < PBKDF2_ITERATIONS };
  }

  // Legacy scrypt: `saltHex:hashHex`. Verify with the original parameters, then
  // signal a rehash so the next successful login upgrades the row to PBKDF2.
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return { ok: false, needsRehash: false };
  const test = crypto.scryptSync(password, salt, LEGACY_SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  const ok =
    expected.length === test.length && crypto.timingSafeEqual(expected, test);
  return { ok, needsRehash: ok };
}
