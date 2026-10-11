/**
 * AlgoHunt DB row types — local copies of what Module 1 will add to
 * src/server/db/schema.ts. Delete these imports and replace with the real
 * schema imports once M1's foundation PR merges.
 *
 * Only the subset needed by Module 2 is included here.
 */

export interface AhEvent {
  id: string;
  slug: string;
  name: string;
  isTest: boolean;
  status: string; // EventStatus
  maxTeamSize: number;
  rankingMode: string;
  leaderboardVisible: boolean;
  submissionsEnabled: boolean;
  codesEnabled: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AhTeam {
  id: string;
  eventId: string;
  teamCode: string;
  teamName: string;
  college: string | null;
  passwordHash: string;
  sessionEpoch: number;
  status: string; // TeamStatus
  checkedInAt: number | null;
  finishedAt: number | null;
  disqualifiedAt: number | null;
  disqualificationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AhChallenge {
  id: string;
  eventId: string;
  slug: string;
  title: string;
  difficulty: string;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  samples: string; // JSON
  contentHtml: string | null; // JSON RenderedContent
  checker: string; // JSON Checker
  timeLimit: string;
  memoryLimit: string;
  languages: string | null; // JSON LanguageId[]
  referenceSolution: string | null; // SECRET
  bruteSolution: string | null; // SECRET
  editorial: string | null; // SECRET
  author: string | null; // SECRET
  verifiedAt: number | null;
  sourceSha256: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AhTestCase {
  id: string;
  challengeId: string;
  idx: number;
  input: string; // SECRET
  output: string; // SECRET
  isSample: boolean;
  createdAt: number;
}

export interface AhStage {
  id: string;
  eventId: string;
  stageNumber: number;
  challengeId: string;
  points: number;
  isFinal: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AhStageProgress {
  id: string;
  eventId: string;
  teamId: string;
  stageId: string;
  challengeSolved: boolean;
  challengeSolvedAt: number | null;
  solvedSubmissionId: string | null;
  codeRedeemed: boolean;
  codeRedeemedAt: number | null;
  redeemedCodeId: string | null;
  completed: boolean;
  completedAt: number | null;
  completionRequestId: string | null;
  manualOverride: boolean;
  overrideReason: string | null;
  overrideBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AhSubmission {
  id: string;
  eventId: string;
  teamId: string;
  stageId: string;
  challengeId: string;
  language: string;
  code: string;
  status: string; // SubmissionStatus
  verdict: string | null; // AhVerdict
  passed: number | null;
  total: number | null;
  failedOn: number | null;
  detail: string | null;
  runtimeMs: number | null;
  clientRequestId: string | null;
  createdAt: number;
  finishedAt: number | null;
}
