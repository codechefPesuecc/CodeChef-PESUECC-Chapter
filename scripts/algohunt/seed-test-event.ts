/**
 * AlgoHunt 2.0 — Seed Test Event CLI
 *
 * Implements §5.4 of Platform_06_Raj_Data_Import_and_QA.md.
 *
 * Seeds a reproducible test event (`test-event-2026`) populated with:
 * - 3 stages with the canonical test problems (A+B, Max of Array, Count Vowels)
 * - 5 test teams (TST-001 .. TST-005) with plaintext credentials
 * - Physical redemption codes for stages 1, 2, and 3
 *
 * Usage:
 *   npm run algohunt:seed
 *   npx tsx scripts/algohunt/seed-test-event.ts [--live]
 *
 * Flags:
 *   --live   Seed event in LIVE status instead of READY status.
 *
 * CONFIDENTIALITY REMINDER:
 * Share these generated credentials and codes with module owners by DM ONLY.
 * Never paste them in Git commits, PRs, issues, or public channels.
 */

import { seedTestEvent } from "../../src/server/algohunt/seed-test";

const FMT = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  magenta: "\x1b[35m",
};

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes("--live");

  console.log(`\n${FMT.bold}── Seeding AlgoHunt 2.0 Test Event ──${FMT.reset}\n`);

  try {
    const result = await seedTestEvent({
      reset: true,
      eventStatus: isLive ? "LIVE" : "READY",
    });

    console.log(`${FMT.green}✓ Event Created:${FMT.reset}`);
    console.log(`  ID:     ${result.event.id}`);
    console.log(`  Slug:   ${result.event.slug}`);
    console.log(`  Name:   ${result.event.name}`);
    console.log(`  Status: ${FMT.bold}${result.event.status}${FMT.reset}\n`);

    console.log(`${FMT.cyan}── Stages & Challenges (3) ──${FMT.reset}`);
    for (const stage of result.stages) {
      const ch = result.challenges.find((c) => c.id === stage.challengeId);
      console.log(
        `  Stage ${stage.stageNumber}: ${ch?.title ?? "Unknown"} (${stage.points} pts)` +
          (stage.isFinal ? ` ${FMT.magenta}[FINAL HUNT]${FMT.reset}` : "") +
          ` — ${ch?.testCount ?? 0} tests loaded`
      );
    }
    console.log();

    console.log(`${FMT.cyan}── Seeded Test Teams (5) ──${FMT.reset}`);
    console.log(
      `${FMT.dim}  Team Code  |  Team Name            |  Password  |  Captain    |  College${FMT.reset}`
    );
    console.log(
      `  -----------+-----------------------+------------+-------------+-----------------------------`
    );

    for (const team of result.teams) {
      const captain = team.members.find((m) => m.isCaptain)?.name ?? team.members[0]?.name ?? "";
      const codePadded = team.teamCode.padEnd(10);
      const namePadded = team.teamName.padEnd(21);
      const passPadded = team.plainPassword.padEnd(10);
      const capPadded = captain.padEnd(11);
      console.log(
        `  ${codePadded} |  ${namePadded} |  ${FMT.bold}${passPadded}${FMT.reset} |  ${capPadded} |  ${team.college ?? ""}`
      );
    }
    console.log();

    console.log(`${FMT.cyan}── Physical Clue Codes (5 per stage) ──${FMT.reset}`);
    for (const batch of result.codeBatches) {
      console.log(`  ${FMT.bold}${batch.batchName}:${FMT.reset}`);
      const codeList = batch.codes.map((c) => c.code).join(", ");
      console.log(`    ${codeList}`);
    }
    console.log();

    console.log(`${FMT.yellow}⚠ CONFIDENTIALITY NOTICE:${FMT.reset}`);
    console.log(
      `  Share these test credentials and codes with module owners by DM (not in git or group chats).\n`
    );

    process.exit(0);
  } catch (err) {
    console.error(`\x1b[31m✗ Seeding failed:${FMT.reset}`, (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
