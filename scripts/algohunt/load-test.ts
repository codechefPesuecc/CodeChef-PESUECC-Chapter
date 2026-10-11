#!/usr/bin/env tsx
/**
 * AlgoHunt 2.0 Judge Load Test (Module 2)
 *
 * Usage:
 *   npx tsx scripts/algohunt/load-test.ts \
 *     --base https://your-deployment.workers.dev \
 *     --creds algohunt-test-creds.json \
 *     --concurrency 50 \
 *     --rounds 3 \
 *     --i-know-this-is-the-test-event
 *
 * Pass criteria:
 *   - 0 JUDGE_UNAVAILABLE (503)
 *   - 0 5xx errors (other than rate-limited 429, which is tracked separately)
 *   - p95 latency < 15 s
 */

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

// ── Argument parsing ────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    base: { type: "string" },
    creds: { type: "string" },
    concurrency: { type: "string", default: "50" },
    rounds: { type: "string", default: "3" },
    "i-know-this-is-the-test-event": { type: "boolean", default: false },
  },
  strict: false,
});

const BASE = (args.base as string | undefined)?.replace(/\/$/, "");
const CREDS_FILE = args.creds as string | undefined;
const CONCURRENCY = parseInt(args.concurrency as string, 10);
const ROUNDS = parseInt(args.rounds as string, 10);
const CONFIRMED = args["i-know-this-is-the-test-event"] as boolean;

if (!CONFIRMED) {
  console.error(
    "ERROR: Missing --i-know-this-is-the-test-event flag.\n" +
    "This script fires many submissions against the test event. Add the flag to confirm.",
  );
  process.exit(1);
}
if (!BASE) {
  console.error("ERROR: --base <url> is required.");
  process.exit(1);
}
if (!CREDS_FILE) {
  console.error("ERROR: --creds <file.json> is required.");
  process.exit(1);
}

// ── Load credentials ────────────────────────────────────────────────────────

interface TeamCreds {
  teamName: string;
  teamCode: string;
  password: string;
}

interface CredsFile {
  eventSlug: string;
  teams: TeamCreds[];
}

let creds: CredsFile;
try {
  creds = JSON.parse(readFileSync(CREDS_FILE, "utf-8")) as CredsFile;
} catch (e) {
  console.error(`ERROR: Could not read creds file "${CREDS_FILE}":`, e);
  process.exit(1);
}

// Safety guard: all team codes must start with TST-
for (const team of creds.teams) {
  if (!team.teamCode.startsWith("TST-")) {
    console.error(
      `ERROR: Team "${team.teamCode}" does not start with "TST-".\n` +
      "This script refuses to run against non-test teams.",
    );
    process.exit(1);
  }
}

console.log(`\n🚀 AlgoHunt 2.0 Judge Load Test`);
console.log(`   Base:        ${BASE}`);
console.log(`   Event:       ${creds.eventSlug}`);
console.log(`   Teams:       ${creds.teams.length}`);
console.log(`   Concurrency: ${CONCURRENCY}`);
console.log(`   Rounds:      ${ROUNDS}`);
console.log(`   Creds:       ${CREDS_FILE}\n`);

// ── Deliberately wrong C++ solution (gives WA on any non-trivial test) ──────
const WRONG_CPP = `#include <bits/stdc++.h>
using namespace std;
int main() {
    // This deliberately outputs 0 for every input (load test WA solution)
    int n;
    while (cin >> n) cout << 0 << "\\n";
    return 0;
}`;

// ── Login all teams ─────────────────────────────────────────────────────────

console.log("⏳ Logging in all test teams…");
const cookies: Map<string, string> = new Map();

async function login(team: TeamCreds): Promise<void> {
  const res = await fetch(`${BASE}/api/algohunt/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ teamCode: team.teamCode, password: team.password }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    console.warn(`  ⚠️  No cookie for ${team.teamCode} (status ${res.status})`);
    return;
  }
  // Extract ah_team=<value>; ...
  const match = setCookie.match(/ah_team=([^;]+)/);
  if (match) {
    cookies.set(team.teamCode, match[1]);
  }
}

await Promise.all(creds.teams.map(login));
const loggedIn = creds.teams.filter((t) => cookies.has(t.teamCode));
console.log(`   ✅ Logged in: ${loggedIn.length}/${creds.teams.length} teams\n`);

if (loggedIn.length === 0) {
  console.error("ERROR: No teams logged in. Check base URL and credentials.");
  process.exit(1);
}

// ── Submit helper ───────────────────────────────────────────────────────────

interface SubmitStat {
  durationMs: number;
  status: number;
  verdict?: string;
  code?: string;
}

async function submitOnce(team: TeamCreds): Promise<SubmitStat> {
  const cookie = cookies.get(team.teamCode);
  if (!cookie) return { durationMs: 0, status: -1 };
  const clientRequestId = crypto.randomUUID();
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/api/algohunt/submissions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `ah_team=${cookie}`,
      },
      body: JSON.stringify({
        language: "cpp",
        code: WRONG_CPP,
        clientRequestId,
      }),
    });
    const durationMs = Date.now() - start;
    let verdict: string | undefined;
    let code: string | undefined;
    try {
      const data = await res.json() as Record<string, unknown>;
      verdict = (data.submission as Record<string, unknown> | undefined)?.verdict as string | undefined;
      code = data.code as string | undefined;
    } catch {}
    return { durationMs, status: res.status, verdict, code };
  } catch (e) {
    return { durationMs: Date.now() - start, status: -1, code: "NETWORK_ERROR" };
  }
}

// ── Run rounds ──────────────────────────────────────────────────────────────

const allStats: SubmitStat[] = [];

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`🔁 Round ${round}/${ROUNDS} — firing ${CONCURRENCY} submissions…`);
  const roundStart = Date.now();

  // Pick CONCURRENCY teams round-robin
  const tasks: Promise<SubmitStat>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const team = loggedIn[i % loggedIn.length];
    tasks.push(submitOnce(team));
  }
  const stats = await Promise.all(tasks);
  allStats.push(...stats);

  const roundMs = Date.now() - roundStart;
  const verdicts = stats.map((s) => s.verdict ?? s.code ?? `HTTP-${s.status}`);
  const verdictCounts: Record<string, number> = {};
  for (const v of verdicts) verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
  console.log(`   Round ${round} done in ${roundMs}ms`);
  console.log(`   Verdicts: ${JSON.stringify(verdictCounts)}`);

  if (round < ROUNDS) {
    const waitMs = 65_000;
    console.log(`   ⏸  Waiting ${waitMs / 1000}s for rate-limit windows to reset…`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

// ── Results table ───────────────────────────────────────────────────────────

const latencies = allStats.map((s) => s.durationMs).sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
const pMax = latencies[latencies.length - 1] ?? 0;

const statusCounts: Record<number, number> = {};
const verdictCounts: Record<string, number> = {};
let judgeUnavailable = 0;
let fivexx = 0;
let tooManyReqs = 0;

for (const s of allStats) {
  statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  if (s.status === 429) tooManyReqs++;
  if (s.status === 503) judgeUnavailable++;
  if (s.status >= 500 && s.status !== 503) fivexx++;
  const v = s.verdict ?? s.code ?? `HTTP-${s.status}`;
  verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
}

console.log("\n─────────────────────────────────────────");
console.log("📊 Load Test Results");
console.log("─────────────────────────────────────────");
console.log(`Total submissions:   ${allStats.length}`);
console.log(`Rounds × concurrency: ${ROUNDS} × ${CONCURRENCY}`);
console.log("");
console.log("Verdict distribution:");
for (const [v, n] of Object.entries(verdictCounts).sort(([, a], [, b]) => b - a)) {
  console.log(`  ${v.padEnd(24)} ${n}`);
}
console.log("");
console.log("HTTP status counts:");
for (const [st, n] of Object.entries(statusCounts)) {
  console.log(`  HTTP ${st}${"".padEnd(20)} ${n}`);
}
console.log("");
console.log(`Latency p50:  ${p50}ms`);
console.log(`Latency p95:  ${p95}ms`);
console.log(`Latency max:  ${pMax}ms`);
console.log(`429 (rate limited): ${tooManyReqs}`);
console.log(`503 JUDGE_UNAVAILABLE: ${judgeUnavailable}`);
console.log(`5xx (other): ${fivexx}`);
console.log("─────────────────────────────────────────");

const pass = judgeUnavailable === 0 && fivexx === 0 && p95 < 15_000;
if (pass) {
  console.log("✅ PASS — 0 JUDGE_UNAVAILABLE, 0 5xx, p95 < 15s");
} else {
  console.log("❌ FAIL");
  if (judgeUnavailable > 0) console.log(`   • ${judgeUnavailable} JUDGE_UNAVAILABLE responses`);
  if (fivexx > 0) console.log(`   • ${fivexx} 5xx errors`);
  if (p95 >= 15_000) console.log(`   • p95 ${p95}ms ≥ 15000ms`);
  console.log("\n   Tell Aniket immediately. Akiro scaling may be needed (docs/HORIZONTAL_SCALING.md).");
  process.exit(1);
}
