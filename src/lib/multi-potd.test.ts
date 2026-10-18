process.env.DATABASE_URL = ":memory:";

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "@/server/db";
import { challenges, submissions, users, attempts } from "@/server/db/schema";
import {
  getDailyChallenges,
  getDailyChallenge,
  isLiveChallenge,
  todayStr,
} from "@/lib/challenges";
import { todayLeaderboard, todayCommonLeaderboard, aggregateLeaderboard } from "@/server/leaderboard";

describe("Multiple Problems of the Day (Multi-POTD)", () => {
  beforeAll(async () => {
    await migrate(getDb() as unknown as Parameters<typeof migrate>[0], { migrationsFolder: "./migrations" });
  });

  beforeEach(async () => {
    const db = getDb();
    await db.delete(submissions);
    await db.delete(attempts);
    await db.delete(challenges);
    await db.delete(users);
  });

  it("allows multiple challenges to be scheduled for the exact same date", async () => {
    const db = getDb();
    const today = todayStr();
    const now = Date.now();

    // Insert Problem 1 for today
    await db.insert(challenges).values({
      slug: "potd-easy",
      title: "Easy Daily Challenge",
      difficulty: "Easy",
      date: today,
      statement: "Solve the easy problem",
      createdAt: now,
      updatedAt: now,
    });

    // Insert Problem 2 for today (this previously would fail with UNIQUE constraint on challenges.date)
    await db.insert(challenges).values({
      slug: "potd-hard",
      title: "Hard Daily Challenge",
      difficulty: "Hard",
      date: today,
      statement: "Solve the hard problem",
      createdAt: now + 1000,
      updatedAt: now + 1000,
    });

    const dailies = await getDailyChallenges();
    expect(dailies).toHaveLength(2);
    expect(dailies.map((c) => c.slug).sort()).toEqual(["potd-easy", "potd-hard"]);

    // Backwards compatibility: getDailyChallenge returns one of them
    const primary = await getDailyChallenge();
    expect(primary).not.toBeNull();
    expect(["potd-easy", "potd-hard"]).toContain(primary?.slug);

    // isLiveChallenge returns true for both
    expect(await isLiveChallenge("potd-easy")).toBe(true);
    expect(await isLiveChallenge("potd-hard")).toBe(true);
    expect(await isLiveChallenge("unknown-slug")).toBe(false);
  });

  it("calculates independent live leaderboards for each POTD and aggregates monthly totals", async () => {
    const db = getDb();
    const today = todayStr();
    const now = Date.now();

    // 1. Create two daily problems
    await db.insert(challenges).values([
      {
        slug: "daily-alpha",
        title: "Daily Alpha",
        difficulty: "Medium",
        date: today,
        statement: "Problem Alpha",
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: "daily-beta",
        title: "Daily Beta",
        difficulty: "Hard",
        date: today,
        statement: "Problem Beta",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Create users
    await db.insert(users).values([
      {
        id: "u1",
        username: "alice",
        name: "Alice A",
        email: "alice@example.com",
        prn: "PES1UG20CS001",
        passwordHash: "hash1",
        createdAt: now,
      },
      {
        id: "u2",
        username: "bob",
        name: "Bob B",
        email: "bob@example.com",
        prn: "PES1UG20CS002",
        passwordHash: "hash2",
        createdAt: now,
      },
    ]);

    // 3. User submissions:
    // On daily-alpha: Alice solves in 10s (faster), Bob solves in 30s.
    // On daily-beta: Bob solves in 15s (faster), Alice solves in 25s.
    await db.insert(submissions).values([
      {
        id: "s1",
        userId: "u1",
        challengeSlug: "daily-alpha",
        language: "python",
        code: "print('alpha')",
        status: "AC",
        ranked: true,
        elapsedSeconds: 10,
        flags: 0,
        createdAt: now + 10_000,
      },
      {
        id: "s2",
        userId: "u2",
        challengeSlug: "daily-alpha",
        language: "cpp",
        code: "int main(){}",
        status: "AC",
        ranked: true,
        elapsedSeconds: 30,
        flags: 0,
        createdAt: now + 30_000,
      },
      {
        id: "s3",
        userId: "u2",
        challengeSlug: "daily-beta",
        language: "cpp",
        code: "int main(){}",
        status: "AC",
        ranked: true,
        elapsedSeconds: 15,
        flags: 0,
        createdAt: now + 15_000,
      },
      {
        id: "s4",
        userId: "u1",
        challengeSlug: "daily-beta",
        language: "python",
        code: "print('beta')",
        status: "AC",
        ranked: true,
        elapsedSeconds: 25,
        flags: 0,
        createdAt: now + 25_000,
      },
    ]);

    // 4. Test today's leaderboard for daily-alpha: Alice should be rank 1 (1000 pts), Bob rank 2 (800 pts)
    const boardAlpha = await todayLeaderboard("daily-alpha");
    expect(boardAlpha).toHaveLength(2);
    expect(boardAlpha[0].display).toBe("alice");
    expect(boardAlpha[0].rank).toBe(1);
    expect(boardAlpha[0].points).toBe(1000);
    expect(boardAlpha[1].display).toBe("bob");
    expect(boardAlpha[1].rank).toBe(2);
    expect(boardAlpha[1].points).toBe(800);

    // 5. Test today's leaderboard for daily-beta: Bob should be rank 1 (1000 pts), Alice rank 2 (800 pts)
    const boardBeta = await todayLeaderboard("daily-beta");
    expect(boardBeta).toHaveLength(2);
    expect(boardBeta[0].display).toBe("bob");
    expect(boardBeta[0].rank).toBe(1);
    expect(boardBeta[0].points).toBe(1000);
    expect(boardBeta[1].display).toBe("alice");
    expect(boardBeta[1].rank).toBe(2);
    expect(boardBeta[1].points).toBe(800);

    // 6. Test today's common/combined leaderboard across both POTDs:
    // Both Alice and Bob have 1000 + 800 = 1800 pts. Alice finished second problem at now+25s, Bob at now+30s.
    const commonBoard = await todayCommonLeaderboard();
    expect(commonBoard).toHaveLength(2);
    expect(commonBoard[0].points).toBe(1800);
    expect(commonBoard[0].solved).toBe(2);
    expect(commonBoard[1].points).toBe(1800);
    expect(commonBoard[1].solved).toBe(2);

    // 7. Test aggregate month leaderboard:
    // Both solved 2 problems, both have 1000 + 800 = 1800 total points!
    const monthBoard = await aggregateLeaderboard("month");
    expect(monthBoard).toHaveLength(2);
    expect(monthBoard[0].points).toBe(1800);
    expect(monthBoard[0].solved).toBe(2);
    expect(monthBoard[1].points).toBe(1800);
    expect(monthBoard[1].solved).toBe(2);
  });
});
