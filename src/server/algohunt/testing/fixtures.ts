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
  for (let i = 0; i < (opts.codes ?? 8); i += 1) {
    const [code] = await db.insert(ahCodes).values({
      id: crypto.randomUUID(), eventId, batchId: batch.id,
      serial: i + 1, code: fixtureCode(i), createdAt: now,
    }).returning();
    codes.push(code);
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
