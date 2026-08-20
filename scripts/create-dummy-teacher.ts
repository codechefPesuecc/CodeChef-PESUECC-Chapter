import crypto from "node:crypto";
import { getDb } from "../src/server/db";
import { users } from "../src/server/db/schema";

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    HASH_BYTES,
    "sha256"
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function createDummyTeacher() {
  const db = getDb();

  const dummyUsername = "dummyteacher";
  const dummyPassword = "TestPassword123";
  const dummyEmail = "dummy.teacher@pesu.edu";

  try {
    const passwordHash = hashPassword(dummyPassword);
    const now = Date.now();

    await db.insert(users).values({
      id: crypto.randomUUID(),
      username: dummyUsername,
      name: "Dummy Teacher",
      email: dummyEmail,
      emailVerified: true,
      srn: null,
      prn: "DUMMY001",
      passwordHash,
      sessionEpoch: 0,
      isAdmin: false,
      isTeacher: false, // Not promoted yet - you'll do this in the UI
      createdAt: now,
    });

    console.log("✓ Dummy teacher user created successfully!");
    console.log("\n📋 Credentials:");
    console.log("  Username: " + dummyUsername);
    console.log("  Password: " + dummyPassword);
    console.log("  Email: " + dummyEmail);
    console.log("\nNow promote this user to teacher via the admin panel!");
  } catch (error) {
    console.error("✗ Failed to create dummy teacher:", error);
    process.exit(1);
  }
}

createDummyTeacher().then(() => {
  console.log("\n✓ Done");
  process.exit(0);
});
