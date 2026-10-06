// Shared AlgoHunt contracts. Keep this module importable from server and client code.

export const EVENT_STATUSES = [
  "DRAFT", "CHECK_IN", "READY", "LIVE", "PAUSED", "ENDED", "ARCHIVED",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Allowed transitions. Anything else is rejected by transitionEvent(). */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  DRAFT: ["CHECK_IN", "READY"],
  CHECK_IN: ["READY", "DRAFT"],
  READY: ["LIVE", "CHECK_IN"],
  LIVE: ["PAUSED", "ENDED"],
  PAUSED: ["LIVE", "ENDED"],
  ENDED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const TEAM_STATUSES = [
  "REGISTERED", "CHECKED_IN", "FINISHED", "DISQUALIFIED",
] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export type StageState =
  | "LOCKED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "CODE_PENDING"
  | "COMPLETED";

export const CODE_STATUSES = ["ACTIVE", "USED", "DISABLED"] as const;
export type CodeStatus = (typeof CODE_STATUSES)[number];
export type RedeemOutcome = "UNLOCKED" | "ALREADY_UNLOCKED" | "ALREADY_USED" | "INVALID";
export type CodeAttemptResult = RedeemOutcome | "NOT_SOLVED" | "COOLDOWN";
export type SubmissionStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";
export type AhVerdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "NO_TESTS" | "ERR";
export type RankingMode = "SOLVED_THEN_TIME" | "POINTS_THEN_TIME";
export type AnnouncementPriority = "INFO" | "WARNING" | "CRITICAL";
export type ActorType = "ADMIN" | "VOLUNTEER" | "TEAM" | "SYSTEM";

export type AuditAction =
  | "team.login" | "team.login_failed" | "team.logout" | "team.checked_in" | "team.password_reset"
  | "submission.judged" | "stage.solved" | "stage.completed" | "team.finished"
  | "code.redeemed" | "code.attempt_suspicious"
  | "code.batch_created" | "code.disabled" | "code.enabled" | "code.batch_disabled" | "code.note_updated"
  | "override.complete_stage" | "override.revert_stage"
  | "team.disqualified" | "team.reinstated"
  | "event.created" | "event.transition" | "event.flags_changed" | "stage.toggled"
  | "announcement.created" | "announcement.deactivated"
  | "volunteer.assigned" | "volunteer.removed"
  | "import.challenge" | "import.stages" | "import.teams" | "challenge.verified" | "export.downloaded";

export type ErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED"
  | "EVENT_NOT_LIVE" | "EVENT_PAUSED" | "EVENT_ENDED"
  | "TEAM_NOT_CHECKED_IN" | "TEAM_DISQUALIFIED" | "TEAM_FINISHED"
  | "STAGE_LOCKED" | "STAGE_DISABLED" | "ALREADY_SOLVED" | "CHALLENGE_NOT_SOLVED"
  | "SUBMISSIONS_DISABLED" | "CODES_DISABLED" | "COOLDOWN"
  | "UNSUPPORTED_LANGUAGE" | "PAYLOAD_TOO_LARGE" | "JUDGE_UNAVAILABLE" | "INTERNAL";

export interface StageSummary {
  number: number;
  state: StageState;
  isFinal: boolean;
  title: string | null;
  solvedAt: number | null;
  completedAt: number | null;
}

export interface CurrentStageView {
  number: number;
  isFinal: boolean;
  state: Exclude<StageState, "LOCKED" | "COMPLETED">;
  challengeTitle: string;
  challengeSolved: boolean;
}

export type NextStepKind =
  | "WAIT_FOR_START" | "NOT_CHECKED_IN" | "SOLVE" | "FIND_CODE"
  | "PAUSED" | "FINISHED" | "ENDED" | "DISQUALIFIED";

export interface NextStep {
  kind: NextStepKind;
  message: string;
}

export interface AnnouncementView {
  id: string;
  message: string;
  priority: AnnouncementPriority;
  createdAt: number;
}

export interface ParticipantState {
  serverNow: number;
  event: {
    name: string;
    status: EventStatus;
    startedAt: number | null;
    pausedAt: number | null;
    endedAt: number | null;
    submissionsEnabled: boolean;
    codesEnabled: boolean;
    leaderboardVisible: boolean;
  };
  team: {
    code: string;
    name: string;
    status: TeamStatus;
    finishedAt: number | null;
    elapsedMs: number | null;
  };
  current: CurrentStageView | null;
  stages: StageSummary[];
  solvedCount: number;
  totalStages: number;
  nextStep: NextStep;
  announcements: AnnouncementView[];
}

export interface LanguageOption {
  id: string;
  label: string;
}

export interface ChallengeView {
  stageNumber: number;
  isFinal: boolean;
  title: string;
  difficulty: string;
  html: {
    statement: string;
    inputFormat: string;
    outputFormat: string;
    constraints: string;
  };
  samples: { input: string; output: string; explanationHtml: string }[];
  timeLimitMs: number;
  memoryLimitMb: number;
  languages: LanguageOption[];
  solved: boolean;
}

export interface SubmissionView {
  id: string;
  stageNumber: number;
  language: string;
  status: SubmissionStatus;
  verdict: AhVerdict | null;
  passed: number | null;
  total: number | null;
  failedOn: number | null;
  detail: string | null;
  runtimeMs: number | null;
  createdAt: number;
  finishedAt: number | null;
}

export interface SubmitResult {
  submission: SubmissionView;
  stage: {
    number: number;
    challengeSolved: boolean;
    needsCode: boolean;
    finished: boolean;
  };
  message: string;
}

export interface RedeemResult {
  result: RedeemOutcome;
  message: string;
  unlockedStageNumber: number | null;
  invalidAttemptsLeft: number | null;
}

export interface LeaderboardRow {
  rank: number;
  teamName: string;
  college: string | null;
  questionsSolved: number;
  points: number;
  finished: boolean;
  finishedAt: number | null;
  lastSolvedAt: number | null;
  isYou: boolean;
}

export interface CodePoolStats {
  total: number;
  active: number;
  used: number;
  disabled: number;
  teamsWaitingForCode: number;
  lastRedeemedAt: number | null;
  redeemedLast10m: number;
}
