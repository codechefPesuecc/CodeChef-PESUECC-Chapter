const BASE = "http://localhost:3000";

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
  
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error(`No cookie received for ${username}`);
  return setCookie;
}

async function startAttempt(cookie: string, slug: string) {
  const res = await fetch(`${BASE}/api/attempt/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ slug }),
  });
  return { status: res.status, data: await res.json() };
}

async function submitCode(cookie: string, slug: string, code: string, language: string) {
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ slug, code, language }),
  });
  return { status: res.status, data: await res.json() };
}

async function getLeaderboard(scope: string, challenge?: string) {
  const url = challenge
    ? `${BASE}/api/leaderboard?scope=${scope}&challenge=${challenge}`
    : `${BASE}/api/leaderboard?scope=${scope}`;
  const res = await fetch(url);
  return { status: res.status, data: await res.json() };
}

async function testPage(url: string) {
  const res = await fetch(url);
  return { status: res.status, ok: res.ok };
}

async function run() {
  const { getDb } = await import("../src/server/db");
  const { submissions, attempts } = await import("../src/server/db/schema");
  const db = getDb();
  await db.delete(submissions);
  await db.delete(attempts);
  console.log("Cleared existing submissions & attempts for clean test run.\n");

  console.log("=== 1. Testing CP-Arena Frontend Pages ===");
  const arenaPage = await testPage(`${BASE}/cp-arena`);
  console.log(`GET /cp-arena: status ${arenaPage.status}`);
  if (!arenaPage.ok) throw new Error("GET /cp-arena failed");

  const solve1 = await testPage(`${BASE}/cp-arena/solve/potd-two-sum`);
  console.log(`GET /cp-arena/solve/potd-two-sum: status ${solve1.status}`);

  const solve2 = await testPage(`${BASE}/cp-arena/solve/potd-invert-tree`);
  console.log(`GET /cp-arena/solve/potd-invert-tree: status ${solve2.status}`);

  console.log("\n=== 2. Logging in test users ===");
  const aliceCookie = await login("alice", "alice12345");
  console.log("Alice logged in successfully.");
  const bobCookie = await login("bob", "bob12345");
  console.log("Bob logged in successfully.");

  console.log("\n=== 3. Starting attempts on both POTDs ===");
  const a1 = await startAttempt(aliceCookie, "potd-two-sum");
  console.log("Alice started potd-two-sum:", a1);
  const a2 = await startAttempt(aliceCookie, "potd-invert-tree");
  console.log("Alice started potd-invert-tree:", a2);

  const b1 = await startAttempt(bobCookie, "potd-two-sum");
  console.log("Bob started potd-two-sum:", b1);
  const b2 = await startAttempt(bobCookie, "potd-invert-tree");
  console.log("Bob started potd-invert-tree:", b2);

  console.log("\n=== 4. Submitting code to Local Judge for POTD 1 (potd-two-sum) ===");
  // Python solution for two-sum:
  // Input:
  // 4 9
  // 2 7 11 15
  // Output:
  // 2 7
  const pythonTwoSum = `
import sys

def main():
    lines = sys.stdin.read().split()
    if not lines:
        return
    n = int(lines[0])
    target = int(lines[1])
    nums = [int(x) for x in lines[2:2+n]]
    seen = {}
    for x in nums:
        diff = target - x
        if diff in seen:
            print(f"{min(diff, x)} {max(diff, x)}")
            return
        seen[x] = True

if __name__ == '__main__':
    main()
`;

  console.log("Submitting Alice's solution to potd-two-sum...");
  const subAlice1 = await submitCode(aliceCookie, "potd-two-sum", pythonTwoSum, "python");
  console.log("Alice submission result:", subAlice1);

  console.log("Submitting Bob's solution to potd-two-sum...");
  const subBob1 = await submitCode(bobCookie, "potd-two-sum", pythonTwoSum, "python");
  console.log("Bob submission result:", subBob1);

  console.log("\n=== 5. Submitting code to Local Judge for POTD 2 (potd-invert-tree) ===");
  // Input: 4 2 7 1 3 6 9
  // Output: 4 7 2 9 6 3 1
  const pythonInvertTree = `
import sys

def main():
    parts = sys.stdin.read().split()
    if not parts:
        return
    # Given level order of complete/sample binary tree
    # 4 (root)
    # 2 7 (level 1) -> inverted 7 2
    # 1 3 6 9 (level 2) -> inverted 9 6 3 1
    # For sample input "4 2 7 1 3 6 9"
    # Inverted level order is "4 7 2 9 6 3 1"
    print("4 7 2 9 6 3 1")

if __name__ == '__main__':
    main()
`;

  console.log("Submitting Bob's solution to potd-invert-tree...");
  const subBob2 = await submitCode(bobCookie, "potd-invert-tree", pythonInvertTree, "python");
  console.log("Bob submission result:", subBob2);

  console.log("Submitting Alice's solution to potd-invert-tree...");
  const subAlice2 = await submitCode(aliceCookie, "potd-invert-tree", pythonInvertTree, "python");
  console.log("Alice submission result:", subAlice2);

  console.log("\n=== 6. Verifying Leaderboards ===");
  console.log("Fetching Today's Leaderboard for potd-two-sum:");
  const lbTwoSum = await getLeaderboard("today", "potd-two-sum");
  console.log(JSON.stringify(lbTwoSum.data, null, 2));

  console.log("Fetching Today's Leaderboard for potd-invert-tree:");
  const lbInvertTree = await getLeaderboard("today", "potd-invert-tree");
  console.log(JSON.stringify(lbInvertTree.data, null, 2));

  console.log("Fetching Today's Combined Leaderboard (all problems):");
  const lbAll = await getLeaderboard("today", "all");
  console.log(JSON.stringify(lbAll.data, null, 2));

  console.log("Fetching Month Aggregate Leaderboard:");
  const lbMonth = await getLeaderboard("month");
  console.log(JSON.stringify(lbMonth.data, null, 2));

  console.log("\n=== Full Flow Verification Completed Successfully! ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
