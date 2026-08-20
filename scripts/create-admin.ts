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

async function createAdmin() {
  const db = getDb();

  const adminUsername = "admin";
  const adminPassword = "fortheloveofcode";
  const adminEmail = "admin@codechef.pesu.edu";

  try {
    // Check if admin already exists
    const existing = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, adminUsername),
    });

    if (existing) {
      console.log("✗ Admin user already exists!");
      console.log(`  Username: ${existing.username}`);
      console.log(`  Email: ${existing.email}`);
      return;
    }

    const passwordHash = hashPassword(adminPassword);
    const now = Date.now();

    // Create the admin user
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

    console.log("✓ Admin user created successfully!");
    console.log("\n📋 Admin Credentials:");
    console.log("  Username: " + adminUsername);
    console.log("  Password: " + adminPassword);
    console.log("  Email: " + adminEmail);
    console.log("\n⚠️  IMPORTANT: Change this password immediately after first login!");
  } catch (error) {
    console.error("✗ Failed to create admin user:", error);
    process.exit(1);
  }
}

createAdmin().then(() => {
  console.log("\n✓ Done");
  process.exit(0);
});
