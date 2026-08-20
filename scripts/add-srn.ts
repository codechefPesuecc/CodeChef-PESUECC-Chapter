import { getDb } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function addSRN() {
  const db = getDb();
  const username = "testuser";
  const srn = "PES2023CS001";

  try {
    const result = await db
      .update(users)
      .set({ srn })
      .where(eq(users.username, username))
      .returning();

    if (result.length === 0) {
      console.log("✗ User not found:", username);
      process.exit(1);
    }

    console.log("✓ SRN added successfully!");
    console.log("\n📋 Updated User:");
    console.log("  Username: " + result[0].username);
    console.log("  Email: " + result[0].email);
    console.log("  SRN: " + result[0].srn);
    console.log("\nTestuser can now join contests!");
  } catch (error) {
    console.error("✗ Failed to add SRN:", error);
    process.exit(1);
  }
}

addSRN().then(() => {
  console.log("\n✓ Done");
  process.exit(0);
});
