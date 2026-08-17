import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";
import { hashPassword, verifyPassword } from "./password";

// Reproduces the pre-migration scrypt hash format (`saltHex:hashHex`, 64-byte key)
// so we can prove legacy rows still verify and are flagged for rehash.
function legacyScryptHash(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Builds a valid PBKDF2 hash at an arbitrary iteration count, to exercise the
// "PBKDF2 below the current cost → needsRehash" branch.
async function pbkdf2HashWithIterations(
  password: string,
  iterations: number,
): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations },
    key,
    256,
  );
  return `pbkdf2$${iterations}$${salt.toString("hex")}$${Buffer.from(bits).toString("hex")}`;
}

describe("password hashing (PBKDF2)", () => {
  it("hashes to the versioned pbkdf2 format", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored).toMatch(/^pbkdf2\$100000\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it("uses a fresh salt each time", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("verifies a correct password", async () => {
    const stored = await hashPassword("s3cret-pass");
    expect(await verifyPassword("s3cret-pass", stored)).toEqual({
      ok: true,
      needsRehash: false,
    });
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("s3cret-pass");
    expect(await verifyPassword("wrong-pass", stored)).toEqual({
      ok: false,
      needsRehash: false,
    });
  });

  it("verifies a legacy scrypt hash and flags it for rehash", async () => {
    const stored = legacyScryptHash("old-user-password");
    expect(await verifyPassword("old-user-password", stored)).toEqual({
      ok: true,
      needsRehash: true,
    });
  });

  it("rejects a wrong password against a legacy scrypt hash", async () => {
    const stored = legacyScryptHash("old-user-password");
    expect(await verifyPassword("nope", stored)).toEqual({
      ok: false,
      needsRehash: false,
    });
  });

  it("flags a PBKDF2 hash below the current iteration count for rehash", async () => {
    const stored = await pbkdf2HashWithIterations("weakly-stretched", 50_000);
    expect(await verifyPassword("weakly-stretched", stored)).toEqual({
      ok: true,
      needsRehash: true,
    });
  });

  it("does not flag a current-cost PBKDF2 hash for rehash", async () => {
    const stored = await pbkdf2HashWithIterations("well-stretched", 100_000);
    expect(await verifyPassword("well-stretched", stored)).toEqual({
      ok: true,
      needsRehash: false,
    });
  });

  it("fails closed (no throw) when the runtime rejects the derivation", async () => {
    // Production workerd caps PBKDF2 iterations at 100k and throws above it; a stored
    // hash the runtime can't derive must yield ok:false, not a 500. Node has no such
    // cap, so stub the derive to reject the way the edge runtime does.
    const stored = await pbkdf2HashWithIterations("some-pass", 50_000);
    const spy = vi
      .spyOn(globalThis.crypto.subtle, "deriveBits")
      .mockRejectedValueOnce(
        new Error("Pbkdf2 failed: iteration counts above 100000 are not supported"),
      );
    try {
      expect(await verifyPassword("some-pass", stored)).toEqual({
        ok: false,
        needsRehash: false,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it.each(["", "garbage", "pbkdf2$onlytwo$parts", "nosalt:", ":nohash", "pbkdf2$210000$$"])(
    "rejects malformed stored value %j",
    async (stored) => {
      expect(await verifyPassword("whatever", stored)).toEqual({
        ok: false,
        needsRehash: false,
      });
    },
  );
});
