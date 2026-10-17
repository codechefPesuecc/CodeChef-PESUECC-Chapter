import { asc, count, eq, sql } from "drizzle-orm";
import { QUESTION_LIMITS } from "@/lib/algohunt/question-schema";
import { getDb } from "@/server/db";
import { ahChallenges, ahCodeBatches, ahStages, ahSubmissions, ahTeams, ahTestCases, type AhEvent } from "@/server/db/schema";
import { getCodePoolStats } from "../codePool";

export interface ContentChallenge {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  /** Hidden tests (sample rows not counted). */
  tests: number;
  samples: number;
  totalChars: number;
  verifiedAt: number | null;
  stageNumber: number | null;
  submissions: number;
}

export interface ContentReport {
  ready: boolean;
  stages: {
    stageNumber: number; isFinal: boolean; enabled: boolean; points: number;
    challenge: ContentChallenge;
    problems: string[];
  }[];
  /** Every imported question, in or out of the order, for the Question order tab. */
  challenges: ContentChallenge[];
  codes: { active: number; used: number; disabled: number; batches: number };
  teams: { total: number; checkedIn: number };
  endsAt: number | null;
  problems: string[];
  warnings: string[];
}

/**
 * Is this event ready to start? (M6 brief §5.5.) Problems make it NOT READY; warnings are things an
 * organizer should see but may have chosen on purpose (fewer codes than teams, for example).
 * Counts only: no statement, test or solution text is read.
 */
export async function getContentReport(event: AhEvent): Promise<ContentReport> {
  const db = getDb();
  const [challengeRows, testRows, stageRows, submissionRows, pool, [batchRow], teamRows] = await Promise.all([
    db.select({
      id: ahChallenges.id, slug: ahChallenges.slug, title: ahChallenges.title,
      difficulty: ahChallenges.difficulty, verifiedAt: ahChallenges.verifiedAt,
    }).from(ahChallenges).where(eq(ahChallenges.eventId, event.id)).orderBy(asc(ahChallenges.slug)),
    db.select({
      challengeId: ahTestCases.challengeId,
      tests: sql<number>`sum(case when ${ahTestCases.isSample} then 0 else 1 end)`,
      samples: sql<number>`sum(case when ${ahTestCases.isSample} then 1 else 0 end)`,
      chars: sql<number>`sum(length(${ahTestCases.input}) + length(${ahTestCases.output}))`,
    }).from(ahTestCases)
      .innerJoin(ahChallenges, eq(ahTestCases.challengeId, ahChallenges.id))
      .where(eq(ahChallenges.eventId, event.id))
      .groupBy(ahTestCases.challengeId),
    db.select({
      stageNumber: ahStages.stageNumber, isFinal: ahStages.isFinal, enabled: ahStages.enabled,
      points: ahStages.points, challengeId: ahStages.challengeId,
    }).from(ahStages).where(eq(ahStages.eventId, event.id)).orderBy(asc(ahStages.stageNumber)),
    db.select({ challengeId: ahSubmissions.challengeId, total: count() }).from(ahSubmissions)
      .where(eq(ahSubmissions.eventId, event.id)).groupBy(ahSubmissions.challengeId),
    getCodePoolStats(event.id),
    db.select({ total: count() }).from(ahCodeBatches).where(eq(ahCodeBatches.eventId, event.id)),
    db.select({ total: count(), checkedIn: count(ahTeams.checkedInAt) }).from(ahTeams).where(eq(ahTeams.eventId, event.id)),
  ]);

  const tests = new Map(testRows.map((row) => [row.challengeId, row]));
  const submissions = new Map(submissionRows.map((row) => [row.challengeId, Number(row.total)]));
  const stageOf = new Map(stageRows.map((row) => [row.challengeId, row.stageNumber]));
  const challenges: ContentChallenge[] = challengeRows.map((row) => {
    const t = tests.get(row.id);
    return {
      ...row,
      tests: Number(t?.tests ?? 0),
      samples: Number(t?.samples ?? 0),
      totalChars: Number(t?.chars ?? 0),
      stageNumber: stageOf.get(row.id) ?? null,
      submissions: submissions.get(row.id) ?? 0,
    };
  });
  const byId = new Map(challenges.map((c) => [c.id, c]));

  const problems: string[] = [];
  const warnings: string[] = [];
  const last = stageRows.length;
  const stages = stageRows.map((stage) => {
    const challenge = byId.get(stage.challengeId)!;
    const stageProblems: string[] = [];
    if (challenge.verifiedAt === null) stageProblems.push("Not verified on Akiro.");
    if (challenge.tests < QUESTION_LIMITS.minTests) stageProblems.push(`Only ${challenge.tests} hidden tests (at least ${QUESTION_LIMITS.minTests}).`);
    if (challenge.samples === 0) stageProblems.push("No sample tests uploaded.");
    if (stage.isFinal !== (stage.stageNumber === last)) {
      stageProblems.push(stage.isFinal ? "Marked final but isn't the last question." : "The last question isn't marked final.");
    }
    for (const problem of stageProblems) problems.push(`Question ${stage.stageNumber}: ${problem}`);
    if (!stage.enabled) warnings.push(`Question ${stage.stageNumber} is disabled: teams on it can't submit.`);
    return { ...stage, challenge, problems: stageProblems };
  });

  if (last === 0) problems.push("No questions in the hunt yet. Import questions and save the question order.");
  if (stageRows.some((stage, i) => stage.stageNumber !== i + 1)) problems.push(`Question numbers must run 1 to ${last} with no gaps.`);
  const teamTotal = Number(teamRows[0]?.total ?? 0);
  const checkedIn = Number(teamRows[0]?.checkedIn ?? 0);
  if (teamTotal === 0) problems.push("No teams yet. Import the roster.");
  if (pool.active === 0) problems.push("No active codes. Generate and print a batch on the Codes page.");
  if (pool.active > 0 && pool.active < teamTotal) {
    warnings.push(`${pool.active} active codes for ${teamTotal} teams: the race for codes will be tight.`);
  }
  if (teamTotal > checkedIn) warnings.push(`${teamTotal - checkedIn} of ${teamTotal} teams aren't checked in yet: they can't play until they are.`);
  if (event.endsAt === null && !event.isTest) warnings.push("No scheduled end time: play won't stop by itself. Set it on the Control page.");
  const orphaned = challenges.filter((c) => c.stageNumber === null);
  if (orphaned.length > 0 && last > 0) {
    warnings.push(`${orphaned.length} imported question${orphaned.length === 1 ? " isn't" : "s aren't"} in the order: ${orphaned.map((c) => c.slug).join(", ")}.`);
  }

  return {
    ready: problems.length === 0,
    stages,
    challenges,
    codes: { active: pool.active, used: pool.used, disabled: pool.disabled, batches: Number(batchRow?.total ?? 0) },
    teams: { total: teamTotal, checkedIn },
    endsAt: event.endsAt,
    problems,
    warnings,
  };
}
