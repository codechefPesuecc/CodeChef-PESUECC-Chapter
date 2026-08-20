import crypto from "node:crypto";
import { getDb } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

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

async function resetAdmin() {
  const db = getDb();

  const adminUsername = "admin";
  const adminPassword = "fortheloveofcode";
  const adminEmail = "admin@codechef.pesu.edu";

  try {
    // Delete existing admin if exists
    await db.delete(users).where(eq(users.username, adminUsername));
    console.log("✓ Old admin user deleted");

    const passwordHash = hashPassword(adminPassword);
    const now = Date.now();

    // Create the new admin user
    await db.insert(users).values({
      id: crypto.randomUUID(),
      username: adminUsername,
      name: "System Administrator",
      email: adminEmail,
      emailVerified: true,
      srn: null,
      prn: "ADMIN001",
      passwordHash,
      sessionEpoch: 0,
      isAdmin: true,
      isTeacher: true,
      createdAt: now,
    });

    console.log("✓ New admin user created successfully!");
    console.log("\n📋 Admin Credentials:");
    console.log("  Username: " + adminUsername);
    console.log("  Password: " + adminPassword);
    console.log("  Email: " + adminEmail);
  } catch (error) {
    console.error("✗ Failed to reset admin user:", error);
    process.exit(1);
  }
}

resetAdmin().then(() => {
  console.log("\n✓ Done");
  process.exit(0);
});
