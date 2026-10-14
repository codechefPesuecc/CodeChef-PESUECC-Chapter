import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  ahChallenges,
  ahCodeAttempts,
  ahCodeBatches,
  ahCodes,
  ahEvents,
  ahStageProgress,
  ahStages,
  ahSubmissions,
  ahTeamMembers,
  ahTeams,
  ahTestCases,
  type AhEvent,
  type AhStage,
} from "@/server/db/schema";
import { TEST_QUESTIONS } from "@/lib/algohunt/test-content";
import type { EventStatus } from "@/lib/algohunt/types";
import { createCodeBatch } from "./codePool";
import { importTeamsChunk, type ImportedTeamRecord, type ParsedTeamRow } from "./teams";

/**
 * AlgoHunt 2.0 — One-Click Test Event Seeder.
 *
 * Implements §5.4 of Platform_06_Raj_Data_Import_and_QA.md.
 *
 * Sets up a reproducible test event (`test-event-2026`) populated with:
 * - 3 stages with the canonical test problems (`tst-a-plus-b`, `tst-max-array`, `tst-count-vowels`)
 * - All hidden tests and samples loaded into `ah_test_cases`
 * - 5 test teams (`TST-001` .. `TST-005`) with human-friendly plain passwords
 * - 3 batches of physical redemption codes in `ah_codes` (5 codes per stage)
 *
 * Used by other module owners (M1, M2, M3, M4, M5) for local development and QA testing.
 */

export interface SeedTestEventOptions {
  slug?: string;
  name?: string;
  reset?: boolean;
  eventStatus?: EventStatus;
}

export interface SeedTestEventResult {
  event: AhEvent;
  challenges: Array<{ id: string; slug: string; title: string; testCount: number }>;
  stages: AhStage[];
  teams: ImportedTeamRecord[];
  codeBatches: Array<{
    batchId: string;
    batchName: string;
    codes: Array<{ serial: number; code: string }>;
  }>;
}

const DEFAULT_SLUG = "test-event-2026";
const DEFAULT_NAME = "AlgoHunt 2.0 Test Arena";

export const TEST_TEAMS_FIXTURE: ParsedTeamRow[] = [
  {
    teamName: "Code Alchemists",
    college: "PES University (EC Campus)",
    teamCode: "TST-001",
    members: [
      { name: "Alice", email: "alice@example.com", isCaptain: true },
      { name: "Bob", email: "bob@example.com" },
      { name: "Charlie", email: "charlie@example.com" },
    ],
  },
  {
    teamName: "Byte Bandits",
    college: "PES University (RR Campus)",
    teamCode: "TST-002",
    members: [
      { name: "Dave", email: "dave@example.com", isCaptain: true },
      { name: "Eve", email: "eve@example.com" },
    ],
  },
  {
    teamName: "Algo Aces",
    college: "BMS College of Engineering",
    teamCode: "TST-003",
    members: [
      { name: "Frank", email: "frank@example.com", isCaptain: true },
      { name: "Grace", email: "grace@example.com" },
      { name: "Heidi", email: "heidi@example.com" },
      { name: "Ivan", email: "ivan@example.com" },
    ],
  },
  {
    teamName: "Null Pointers",
    college: "RV College of Engineering",
    teamCode: "TST-004",
    members: [
      { name: "Judy", email: "judy@example.com", isCaptain: true },
    ],
  },
  {
    teamName: "Syntax Strikers",
    college: "MSRIT",
    teamCode: "TST-005",
    members: [
      { name: "Mallory", email: "mallory@example.com", isCaptain: true },
      { name: "Oscar", email: "oscar@example.com" },
      { name: "Peggy", email: "peggy@example.com" },
    ],
  },
];

export async function seedTestEvent(options: SeedTestEventOptions = {}): Promise<SeedTestEventResult> {
  const db = getDb();
  const slug = options.slug ?? DEFAULT_SLUG;
  const name = options.name ?? DEFAULT_NAME;
  const reset = options.reset ?? true;
  const targetStatus = options.eventStatus ?? "READY";

  // Check if event already exists
  const [existingEvent] = await db
    .select()
    .from(ahEvents)
    .where(eq(ahEvents.slug, slug))
    .limit(1);

  if (existingEvent) {
    if (reset) {
      const eventId = existingEvent.id;
      // Clean up previous test event artifacts
      const teams = await db.select({ id: ahTeams.id }).from(ahTeams).where(eq(ahTeams.eventId, eventId));
      const teamIds = teams.map((t) => t.id);

      if (teamIds.length > 0) {
        await db.delete(ahTeamMembers).where(inArray(ahTeamMembers.teamId, teamIds));
        await db.delete(ahStageProgress).where(eq(ahStageProgress.eventId, eventId));
        await db.delete(ahSubmissions).where(eq(ahSubmissions.eventId, eventId));
        await db.delete(ahCodeAttempts).where(eq(ahCodeAttempts.eventId, eventId));
        await db.delete(ahTeams).where(eq(ahTeams.eventId, eventId));
      }

      await db.delete(ahCodes).where(eq(ahCodes.eventId, eventId));
      await db.delete(ahCodeBatches).where(eq(ahCodeBatches.eventId, eventId));
      await db.delete(ahStages).where(eq(ahStages.eventId, eventId));

      const challenges = await db.select({ id: ahChallenges.id }).from(ahChallenges).where(eq(ahChallenges.eventId, eventId));
      const challengeIds = challenges.map((c) => c.id);
      if (challengeIds.length > 0) {
        await db.delete(ahTestCases).where(inArray(ahTestCases.challengeId, challengeIds));
        await db.delete(ahChallenges).where(eq(ahChallenges.eventId, eventId));
      }

      await db.delete(ahEvents).where(eq(ahEvents.id, eventId));
    } else {
      throw new Error(`Event with slug "${slug}" already exists. Set reset=true to overwrite.`);
    }
  }

  const now = Date.now();
  const eventId = crypto.randomUUID();

  // 1. Create Event
  const [event] = await db
    .insert(ahEvents)
    .values({
      id: eventId,
      slug,
      name,
      isTest: true,
      status: targetStatus,
      maxTeamSize: 4,
      rankingMode: "SOLVED_THEN_TIME",
      leaderboardVisible: true,
      submissionsEnabled: true,
      codesEnabled: true,
      startedAt: targetStatus === "LIVE" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 2. Insert Problems and Stages
  const createdChallenges: Array<{ id: string; slug: string; title: string; testCount: number }> = [];
  const createdStages: AhStage[] = [];

  const stagePoints = [100, 200, 300];

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const q = TEST_QUESTIONS[i];
    const challengeId = crypto.randomUUID();
    const stageId = crypto.randomUUID();
    const stageNumber = i + 1;
    const isFinal = i === TEST_QUESTIONS.length - 1;
    const points = stagePoints[i] ?? 100;

    // Insert challenge
    await db.insert(ahChallenges).values({
      id: challengeId,
      eventId,
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      statement: q.statement,
      inputFormat: q.inputFormat ?? null,
      outputFormat: q.outputFormat ?? null,
      constraints: q.constraints ?? null,
      samples: JSON.stringify(q.samples),
      checker: JSON.stringify(q.checker ?? { type: "token" }),
      timeLimit: q.timeLimit,
      memoryLimit: q.memoryLimit,
      languages: q.languages ? JSON.stringify(q.languages) : null,
      referenceSolution: JSON.stringify(q.referenceSolution),
      bruteSolution: q.bruteSolution ? JSON.stringify(q.bruteSolution) : null,
      editorial: q.editorial ?? null,
      author: q.author,
      verifiedAt: now,
      sourceSha256: null,
      createdAt: now,
      updatedAt: now,
    });

    // Insert test cases
    const sampleInputSet = new Set(q.samples.map((s) => s.input));
    for (let testIdx = 0; testIdx < q.tests.length; testIdx++) {
      const t = q.tests[testIdx];
      await db.insert(ahTestCases).values({
        id: crypto.randomUUID(),
        challengeId,
        idx: testIdx + 1,
        input: t.input,
        output: t.output,
        isSample: sampleInputSet.has(t.input),
        createdAt: now,
      });
    }

    createdChallenges.push({
      id: challengeId,
      slug: q.slug,
      title: q.title,
      testCount: q.tests.length,
    });

    // Insert stage
    const [stage] = await db
      .insert(ahStages)
      .values({
        id: stageId,
        eventId,
        stageNumber,
        challengeId,
        points,
        isFinal,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    createdStages.push(stage);
  }

  // 3. Seed Teams
  const importResult = await importTeamsChunk({
    eventId,
    teams: TEST_TEAMS_FIXTURE,
    startingIndex: 1,
    actorId: "seed-test-script",
  });

  if (!importResult.ok) {
    throw new Error(`Failed to import test teams: ${importResult.message}`);
  }

  // 4. Seed Code Batches (5 codes per stage)
  const codeBatches: SeedTestEventResult["codeBatches"] = [];
  for (let stageNum = 1; stageNum <= 3; stageNum++) {
    const batchRes = await createCodeBatch({
      eventId,
      name: `Stage ${stageNum} Physical Clues`,
      size: 5,
      adminId: "seed-test-script",
    });

    if (batchRes.ok) {
      codeBatches.push({
        batchId: batchRes.batch.id,
        batchName: batchRes.batch.name,
        codes: batchRes.codes,
      });
    }
  }

  return {
    event,
    challenges: createdChallenges,
    stages: createdStages,
    teams: importResult.imported,
    codeBatches,
  };
}
