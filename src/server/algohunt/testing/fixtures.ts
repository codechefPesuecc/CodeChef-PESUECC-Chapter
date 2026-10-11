/**
 * AlgoHunt test helpers — local stub until Module 1 lands.
 * Module 1 owns the real implementation in src/server/algohunt/testing/.
 *
 * These are used only in *.test.ts files.
 */
import type { AhEvent, AhTeam, AhChallenge, AhStage, AhStageProgress } from "@/lib/algohunt/_mock-db-types";
import type { TeamContext } from "@/server/algohunt/teamSession";
import type { TeamProgress, StageWithProgress } from "@/server/algohunt/access";
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
