import { hashPassword } from "../src/server/auth/password";
import { getDb } from "../src/server/db";
import { users, challenges } from "../src/server/db/schema";
import { todayStr } from "../src/lib/challenges";

async function main() {
  const db = getDb();
  const now = Date.now();
  const today = todayStr();

  console.log("Seeding admin and dummy accounts...");

  // 1. Admin account
  const adminPassHash = await hashPassword("fortheloveofcode");
  await db
    .insert(users)
    .values({
      id: "usr_admin_001",
      username: "admin",
      name: "Admin User",
      email: "admin@pes.edu",
      isAdmin: true,
      passwordHash: adminPassHash,
      emailVerified: true,
      prn: "PES1UGADMIN001",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        isAdmin: true,
        passwordHash: adminPassHash,
        emailVerified: true,
      },
    });

  // 2. Dummy user 1: alice
  const alicePassHash = await hashPassword("alice12345");
  await db
    .insert(users)
    .values({
      id: "usr_alice_001",
      username: "alice",
      name: "Alice Smith",
      email: "alice@pes.edu",
      isAdmin: false,
      passwordHash: alicePassHash,
      emailVerified: true,
      prn: "PES1UG22CS001",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: alicePassHash,
        emailVerified: true,
      },
    });

  // 3. Dummy user 2: bob
  const bobPassHash = await hashPassword("bob12345");
  await db
    .insert(users)
    .values({
      id: "usr_bob_001",
      username: "bob",
      name: "Bob Jones",
      email: "bob@pes.edu",
      isAdmin: false,
      passwordHash: bobPassHash,
      emailVerified: true,
      prn: "PES1UG22CS002",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: bobPassHash,
        emailVerified: true,
      },
    });

  console.log("Seeding today's Multi-POTD challenges (Date: " + today + ")...");

  // Multi-POTD Challenge 1: Two Sum Daily
  await db
    .insert(challenges)
    .values({
      slug: "potd-two-sum",
      title: "POTD 1: Two Sum",
      difficulty: "Easy",
      date: today,
      tags: JSON.stringify(["arrays", "hash-table"]),
      author: "CodeChef PESUECC",
      statement: "Given an array of integers `nums` and an integer `target`, return the two numbers that add up to `target`.\n\nInput format: line 1 integer N and target, line 2 N integers.",
      inputFormat: "N target\nnums[0] nums[1] ... nums[N-1]",
      outputFormat: "Two integers",
      constraints: "2 <= N <= 10^5",
      samples: JSON.stringify([
        { input: "4 9\n2 7 11 15", output: "2 7" }
      ]),
      contentHtml: JSON.stringify({
        statement: "<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return the two numbers that add up to <code>target</code>.</p>",
        inputFormat: "<p><code>N target</code><br/><code>nums[0] ...</code></p>",
        outputFormat: "<p>Two integers</p>",
        constraints: "<p>2 &le; N &le; 10<sup>5</sup></p>",
        sampleExplanations: ["2 + 7 = 9"]
      }),
      tests: JSON.stringify([
        { input: "4 9\n2 7 11 15\n", output: "2 7\n" },
        { input: "3 6\n3 2 4\n", output: "2 4\n" }
      ]),
      checker: JSON.stringify({ type: "token" }),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: challenges.slug,
      set: {
        date: today,
        updatedAt: now,
      },
    });

  // Multi-POTD Challenge 2: Invert Binary Tree Daily
  await db
    .insert(challenges)
    .values({
      slug: "potd-invert-tree",
      title: "POTD 2: Invert Tree Sequence",
      difficulty: "Medium",
      date: today,
      tags: JSON.stringify(["tree", "recursion"]),
      author: "CodeChef PESUECC",
      statement: "Given the level order traversal of a tree, invert the tree and return the reversed level order.\n\nSimple demo challenge for Multi-POTD.",
      inputFormat: "Space separated numbers",
      outputFormat: "Space separated numbers inverted",
      constraints: "1 <= N <= 100",
      samples: JSON.stringify([
        { input: "4 2 7 1 3 6 9", output: "4 7 2 9 6 3 1" }
      ]),
      contentHtml: JSON.stringify({
        statement: "<p>Given the level order traversal of a tree, invert the tree and return the reversed level order.</p>",
        inputFormat: "<p>Space separated numbers</p>",
        outputFormat: "<p>Space separated numbers inverted</p>",
        constraints: "<p>1 &le; N &le; 100</p>",
        sampleExplanations: []
      }),
      tests: JSON.stringify([
        { input: "4 2 7 1 3 6 9\n", output: "4 7 2 9 6 3 1\n" }
      ]),
      checker: JSON.stringify({ type: "token" }),
      createdAt: now + 1000,
      updatedAt: now + 1000,
    })
    .onConflictDoUpdate({
      target: challenges.slug,
      set: {
        date: today,
        updatedAt: now,
      },
    });

  console.log("Seeding completed successfully!");
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
