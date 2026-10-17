// In-memory test data: await setupTestDb(); await resetAlgoHuntTables();
// const fixture = await seedFixture(); then ctxFor(fixture) for engine calls.
import crypto from "node:crypto";
import type { EventStatus, TeamStatus } from "@/lib/algohunt/types";
import { hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db";
import {
  ahChallenges, ahCodeBatches, ahCodes, ahEvents, ahStages, ahTeams, ahTestCases, users,
  type AhChallenge, type AhCode, type AhCodeBatch, type AhEvent, type AhStage, type AhTeam,
} from "@/server/db/schema";
import type { TeamContext } from "../teamSession";

export interface Fixture {
  event: AhEvent;
  stages: AhStage[];
  challenges: AhChallenge[];
  batch: AhCodeBatch;
  codes: AhCode[];
  teams: { team: AhTeam; password: string }[];
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function fixtureCode(index: number): string {
  if (index === 0) return "AAAA2222";
  if (index === 1) return "BBBB3333";
  if (index === 2) return "CCCC4444";
  let value = index + 3;
  let code = "";
  while (value > 0) {
    code = CODE_ALPHABET[value % CODE_ALPHABET.length] + code;
    value = Math.floor(value / CODE_ALPHABET.length);
  }
  return code.padStart(8, "2");
}

export async function seedFixture(opts: {
  stages?: number;
  eventStatus?: EventStatus;
  teamStatus?: TeamStatus;
  teams?: number;
  codes?: number;
} = {}): Promise<Fixture> {
  const db = getDb();
  const now = Date.now();
  const eventStatus = opts.eventStatus ?? "LIVE";
  const teamStatus = opts.teamStatus ?? "CHECKED_IN";
  const eventId = crypto.randomUUID();
  const [event] = await db.insert(ahEvents).values({
    id: eventId,
    slug: `fixture-${eventId}`,
    name: "Fixture hunt",
    isTest: true,
    status: eventStatus,
    startedAt: ["LIVE", "PAUSED", "ENDED", "ARCHIVED"].includes(eventStatus) ? now - 60_000 : null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  const challenges: AhChallenge[] = [];
  const stages: AhStage[] = [];
  for (let i = 1; i <= (opts.stages ?? 3); i += 1) {
    const challengeId = crypto.randomUUID();
    const [challenge] = await db.insert(ahChallenges).values({
      id: challengeId,
      eventId,
      slug: `question-${i}`,
      title: `Question ${i}`,
      statement: "Read one integer and print it.",
      referenceSolution: JSON.stringify({ language: "cpp", code: "#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<n<<'\\n';}" }),
      createdAt: now,
      updatedAt: now,
    }).returning();
    challenges.push(challenge);
    await db.insert(ahTestCases).values({
      id: crypto.randomUUID(), challengeId, idx: 0,
      input: "1\n", output: "1\n", isSample: true, createdAt: now,
    });
    const [stage] = await db.insert(ahStages).values({
      id: crypto.randomUUID(), eventId, stageNumber: i, challengeId,
      isFinal: i === (opts.stages ?? 3), createdAt: now, updatedAt: now,
    }).returning();
    stages.push(stage);
  }

  const password = "fixture-pass";
  const passwordHash = await hashPassword(password);
  const teams: Fixture["teams"] = [];
  for (let i = 0; i < (opts.teams ?? 2); i += 1) {
    const [team] = await db.insert(ahTeams).values({
      id: crypto.randomUUID(), eventId,
      teamCode: `AH2-T${String(i + 1).padStart(3, "0")}`,
      teamName: i === 0 ? "Team Alpha" : i === 1 ? "Team Beta" : `Team ${i + 1}`,
      passwordHash, status: teamStatus,
      checkedInAt: teamStatus === "REGISTERED" ? null : now - 30_000,
      createdAt: now, updatedAt: now,
    }).returning();
    teams.push({ team, password });
  }

  const [batch] = await db.insert(ahCodeBatches).values({
    id: crypto.randomUUID(), eventId, name: "Fixture codes",
    size: opts.codes ?? 8, createdBy: "fixture-admin", createdAt: now,
  }).returning();
  const codes: AhCode[] = [];
  const usedCodes = new Set((await db.select({ code: ahCodes.code }).from(ahCodes)).map((row) => row.code));
  let alternateCodeIndex = 1_000;
  for (let i = 0; i < (opts.codes ?? 8); i += 1) {
    let codeValue = fixtureCode(i);
    while (usedCodes.has(codeValue)) codeValue = fixtureCode(alternateCodeIndex++);
    const [code] = await db.insert(ahCodes).values({
      id: crypto.randomUUID(), eventId, batchId: batch.id,
      serial: i + 1, code: codeValue, createdAt: now,
    }).returning();
    codes.push(code);
    usedCodes.add(codeValue);
  }
  return { event, stages, challenges, batch, codes, teams };
}

export async function createSiteUser(opts: { isAdmin?: boolean; username?: string } = {}): Promise<{ id: string; username: string }> {
  const id = crypto.randomUUID();
  const username = opts.username ?? `fixture-${id.slice(0, 8)}`;
  await getDb().insert(users).values({
    id, username, email: `${username}@example.test`, prn: id,
    passwordHash: "fixture", isAdmin: opts.isAdmin ?? false, createdAt: Date.now(),
  });
  return { id, username };
}

export function ctxFor(fixture: Fixture, teamIndex = 0): TeamContext {
  return { team: fixture.teams[teamIndex].team, event: fixture.event };
}

/** Mark the team's current question Accepted through the real progression engine. */
export async function solveCurrent(fixture: Fixture, teamIndex = 0): Promise<void> {
  const { getTeamProgress } = await import("../access");
  const { recordChallengeSolved } = await import("../progression");
  const ctx = ctxFor(fixture, teamIndex);
  const current = (await getTeamProgress(ctx)).current;
  if (!current) throw new Error("Fixture team has no current question");
  await recordChallengeSolved({ ctx, stageId: current.stage.id, submissionId: crypto.randomUUID() });
}

// ── In-memory Unit Test Helpers (Module 2) ──────────────────────────────────
import type { AhStageProgress } from "@/server/db/schema";
import type { TeamProgress, StageWithProgress } from "../access";
import { deriveStageState } from "@/lib/algohunt/stage-state";

/** Build a minimal AhEvent for tests. */
export function makeEvent(overrides?: Partial<AhEvent>): AhEvent {
  return {
    id: "evt-1",
    slug: "algohunt-test",
    name: "AlgoHunt 2.0 (Test)",
    isTest: true,
    status: "LIVE",
    maxTeamSize: 4,
    rankingMode: "SOLVED_THEN_TIME",
    leaderboardVisible: true,
    submissionsEnabled: true,
    codesEnabled: true,
    startedAt: Date.now() - 60_000,
    pausedAt: null,
    endedAt: null,
    endsAt: null,
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now() - 60_000,
    ...overrides,
  };
}

/** Build a minimal AhTeam for tests. */
export function makeTeam(overrides?: Partial<AhTeam>): AhTeam {
  return {
    id: "team-1",
    eventId: "evt-1",
    teamCode: "TST-T001",
    teamName: "Test Team",
    college: "PES University",
    passwordHash: "hash",
    sessionEpoch: 0,
    activeDeviceId: null,
    status: "CHECKED_IN",
    checkedInAt: Date.now() - 60_000,
    finishedAt: null,
    disqualifiedAt: null,
    disqualificationReason: null,
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now() - 60_000,
    ...overrides,
  };
}

/** Build a minimal TeamContext for tests. */
export function makeCtx(overrides?: { team?: Partial<AhTeam>; event?: Partial<AhEvent> }): TeamContext {
  return {
    team: makeTeam(overrides?.team),
    event: makeEvent(overrides?.event),
  };
}

/** Build a minimal AhChallenge for tests. */
export function makeChallenge(overrides?: Partial<AhChallenge>): AhChallenge {
  return {
    id: "ch-1",
    eventId: "evt-1",
    slug: "test-problem",
    title: "Test Problem",
    difficulty: "Easy",
    statement: "Print the sum of two integers.",
    inputFormat: "Two integers A and B.",
    outputFormat: "Print A + B.",
    constraints: "1 ≤ A, B ≤ 100",
    samples: JSON.stringify([{ input: "1 2\n", output: "3\n" }]),
    contentHtml: JSON.stringify({
      statement: "<p>Print the sum of two integers.</p>",
      inputFormat: "<p>Two integers A and B.</p>",
      outputFormat: "<p>Print A + B.</p>",
      constraints: "<p>1 ≤ A, B ≤ 100</p>",
      sampleExplanations: [""],
    }),
    checker: JSON.stringify({ type: "token" }),
    timeLimit: "2s",
    memoryLimit: "256MB",
    languages: null,
    referenceSolution: null,
    bruteSolution: null,
    editorial: null,
    author: null,
    verifiedAt: null,
    sourceSha256: null,
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now() - 120_000,
    ...overrides,
  };
}

/** Build a minimal AhStage for tests. */
export function makeStage(overrides?: Partial<AhStage>): AhStage {
  return {
    id: "stage-1",
    eventId: "evt-1",
    stageNumber: 1,
    challengeId: "ch-1",
    points: 100,
    isFinal: false,
    enabled: true,
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now() - 120_000,
    ...overrides,
  };
}

/** Build a StageWithProgress for tests. */
export function makeStageWithProgress(
  stage: AhStage,
  challengeTitle: string,
  progress: AhStageProgress | null,
  accessible: boolean,
  hasSubmission: boolean,
): StageWithProgress {
  const state = deriveStageState({
    accessible,
    hasSubmission,
    challengeSolved: progress?.challengeSolved ?? false,
    completed: progress?.completed ?? false,
  });
  return { stage, challengeTitle, progress, accessible, hasSubmission, state };
}

/** Build a TeamProgress for tests. */
export function makeTeamProgress(
  stages: StageWithProgress[],
  current: StageWithProgress | null,
  overrides?: Partial<TeamProgress>,
): TeamProgress {
  const solvedCount = stages.filter((s) => s.progress?.challengeSolved).length;
  const completedCount = stages.filter((s) => s.progress?.completed).length;
  return {
    stages,
    current,
    solvedCount,
    completedCount,
    totalStages: stages.length,
    finished: stages.length > 0 && stages.every((s) => s.progress?.completed),
    ...overrides,
  };
}

