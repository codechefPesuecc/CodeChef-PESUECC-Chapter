import { sqliteTable, text, integer, unique, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/**
 * Arena persistence (SQLite via libSQL in dev, Cloudflare D1 in prod / Drizzle).
 *
 * The DB holds the problems (challenges), accounts, and the dynamic state — who
 * solved what, when, and how. Timestamps are unix epoch milliseconds recorded
 * server-side, so solve ordering can't be spoofed by the client. Sessions are
 * stateless signed cookies, so there's no sessions table.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  // Public leaderboard identity; real name / SRN / PRN / email stay private.
  username: text("username").notNull().unique(),
  // Full name captured at registration. Nullable so existing rows are unaffected.
  name: text("name"),
  // WhatsApp / phone number. Nullable so existing rows are unaffected.
  phone: text("phone"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  // Student registration number — permanent, filled in once assigned (first
  // years register with only a PRN). Both are unique → one account per student.
  srn: text("srn").unique(),
  prn: text("prn").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Bumped on password reset — stateless session tokens carry this epoch and are
  // rejected once it changes, so a reset (or recovery from a compromise) logs out
  // every existing session.
  sessionEpoch: integer("session_epoch").notNull().default(0),
  // Grants access to the admin console (/admin) — CP Arena problem authoring and
  // management. Bootstrapped out-of-band for the first admin (see the admin-console
  // PR notes); a future admin screen can toggle it. The ADD COLUMN backfills every
  // existing user to non-admin.
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  // Grants access to Monstr teacher features — contest creation and management.
  // Promoted by admins via /api/admin/teachers.
  isTeacher: integer("is_teacher", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

// Email OTP codes (hashed). One active row per user; verified on match.
export const emailVerifications = sqliteTable("email_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

// Password reset tokens (hashed). One active row per user; single-use link.
export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  challengeSlug: text("challenge_slug").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  language: text("language").notNull(),
  code: text("code").notNull(),
  // AC | WA | TLE | RE | CE | pending
  status: text("status").notNull().default("pending"),
  runtimeMs: integer("runtime_ms"),
  // Server-computed solve duration for ranked submissions: submit time minus the
  // first-open time recorded in `attempts` — never the client's stopwatch.
  // Null for practice (past-problem) solves, which carry no attempt clock.
  // Official ordering still uses createdAt.
  elapsedSeconds: integer("elapsed_seconds"),
  // Integrity signals captured client-side for review.
  flags: integer("flags").notNull().default(0),
  flagsBreakdown: text("flags_breakdown"),
  // True for a live Problem-of-the-Day solve (speed-bounty eligible); false for a
  // past/practice solve (flat base points, never shifts anyone's speed rank).
  // Existing rows predate practice recording and were all live, so the ADD COLUMN
  // backfills them to true.
  ranked: integer("ranked", { mode: "boolean" }).notNull().default(true),
  // Authoritative server receive time.
  createdAt: integer("created_at").notNull(),
});

// Server-recorded solve clock: when a candidate first opened the ranked Problem
// of the Day. One immutable row per (user, challenge) — the official solve time
// is the accepted submission's createdAt minus startedAt, so it can't be spoofed
// and survives reloads / a device switch. Past-problem practice never records
// here (the start endpoint no-ops unless the slug is today's POTD).
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    challengeSlug: text("challenge_slug").notNull(),
    // Unix epoch ms of first open, server-recorded.
    startedAt: integer("started_at").notNull(),
    // Server-authoritative integrity flag count for this ranked attempt, accumulated
    // live via /api/attempt/flag so it survives a page refresh (the client-side
    // counter alone reset to 0 on reload). This total — not the client's payload —
    // is what a submission is scored against.
    flags: integer("flags").notNull().default(0),
    // Per-category breakdown, JSON: {paste,copy,cut,tabSwitch,contextMenu,screenshot}.
    flagsBreakdown: text("flags_breakdown").notNull().default("{}"),
  },
  (t) => [unique().on(t.userId, t.challengeSlug)],
);

// Fixed-window rate-limit counters, keyed like `login:ip:1.2.3.4`. Lives in the
// DB (not process memory) so the limit holds across Cloudflare Worker isolates,
// which each have their own memory. `resetAt` is when the current window ends.
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: integer("reset_at").notNull(),
});

// Problems live in the DB (not the git repo) — one row per challenge, so a new
// problem is published by an insert, not a redeploy. The hidden `tests` and
// `checker` are SECRET (judge-only): never selected for listings and never sent
// to the client — only `toPublicContent` fields are public. A problem is
// "released" once its `date` (IST, YYYY-MM-DD) has arrived. Prose fields hold
// Markdown, rendered to sanitized HTML server-side. Arrays/objects (tags,
// samples, tests, checker) are stored as JSON text.
export const challenges = sqliteTable("challenges", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull().default("Unrated"),
  tags: text("tags").notNull().default("[]"), // JSON string[]
  // YYYY-MM-DD (IST). NULL = in the pool (unscheduled, hidden, unsolvable).
  // Set = scheduled for that day: == today → live POTD, < today → practice
  // archive, > today → queued/future. Exactly one problem may hold a given date
  // (uniqueIndex below); SQLite treats NULLs as distinct so many can pool.
  date: text("date"),
  timeLimit: text("time_limit"),
  memoryLimit: text("memory_limit"),
  author: text("author"),
  statement: text("statement").notNull(), // Markdown
  inputFormat: text("input_format"),
  outputFormat: text("output_format"),
  constraints: text("constraints"),
  samples: text("samples").notNull().default("[]"), // JSON Sample[] (public)
  // Pre-rendered, sanitized HTML for the prose fields + per-sample explanations,
  // built once at seed time (scripts/seed-challenges.ts) so the request path serves
  // stored HTML instead of running the Markdown pipeline on every load. JSON shape:
  // { statement, inputFormat, outputFormat, constraints, sampleExplanations[] }.
  // Nullable so the ADD COLUMN is safe; populated by re-seeding after the migration.
  contentHtml: text("content_html"), // JSON RenderedContent (public, derived)
  tests: text("tests").notNull().default("[]"), // JSON TestCase[] — SECRET, judge only
  checker: text("checker").notNull().default('{"type":"token"}'), // JSON { type, epsilon? }
  schemaVersion: integer("schema_version").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => ({
  // One problem per calendar day (the Problem of the Day). NULL dates (pool) are
  // exempt — SQLite unique indexes treat NULLs as distinct, so the pool is unbounded.
  dateUnique: uniqueIndex("challenges_date_unique").on(t.date),
}));

export const monstrContests = sqliteTable("monstr_contests", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  joinCode: text("join_code").notNull().unique(),
  durationMinutes: integer("duration_minutes").notNull(),
  allowedLanguages: text("allowed_languages").notNull(), // JSON string[]
  startedAt: integer("started_at"), // null = not started
  endsAt: integer("ends_at"), // null until started
  createdAt: integer("created_at").notNull(),
});

export const monstrProblems = sqliteTable("monstr_problems", {
  id: text("id").primaryKey(),
  contestId: text("contest_id")
    .notNull()
    .references(() => monstrContests.id),
  orderIndex: integer("order_index").notNull().default(0),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  inputFormat: text("input_format"),
  outputFormat: text("output_format"),
  constraints: text("constraints"),
  timeLimit: text("time_limit"),
  memoryLimit: text("memory_limit"),
  samples: text("samples").notNull().default("[]"), // JSON Sample[]
  contentHtml: text("content_html"), // JSON RenderedContent
  tests: text("tests").notNull().default("[]"), // JSON TestCase[] — SECRET
  checker: text("checker").notNull().default('{"type":"token"}'), // JSON Checker
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const monstrParticipants = sqliteTable(
  "monstr_participants",
  {
    id: text("id").primaryKey(),
    contestId: text("contest_id")
      .notNull()
      .references(() => monstrContests.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => [unique().on(t.contestId, t.userId)],
);

export const monstrSubmissions = sqliteTable("monstr_submissions", {
  id: text("id").primaryKey(),
  contestId: text("contest_id")
    .notNull()
    .references(() => monstrContests.id),
  problemId: text("problem_id")
    .notNull()
    .references(() => monstrProblems.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  language: text("language").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull().default("pending"), // AC | WA | TLE | MLE | RE | CE | ERR
  runtimeMs: integer("runtime_ms"),
  createdAt: integer("created_at").notNull(),
});

// Recruitment drive settings — exactly one row (id = "current"). The form URL and
// the open/closed flag live in the DB rather than in code so a new cycle is a paste
// in /admin/recruitment, not a redeploy — the same reason challenges aren't in the
// repo. Applications themselves are handled in Google Forms; this table only holds
// which form /join embeds and whether to show it.
export const recruitmentSettings = sqliteTable("recruitment_settings", {
  id: text("id").primaryKey(),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(false),
  // Google Forms URL. NULL until an admin configures it — /join then renders its
  // closed state instead of an empty frame, which is what a freshly migrated
  // production database looks like.
  formUrl: text("form_url"),
  cycle: text("cycle"), // e.g. "2026-27", shown in the /join hero
  closesOn: text("closes_on"), // YYYY-MM-DD (IST), display only — never enforced
  updatedAt: integer("updated_at").notNull(),
  // Audit breadcrumb: which admin last changed the drive. Deliberately NOT a
  // foreign key — `deleteUser` (src/server/admin/users.ts) removes a user by
  // deleting their child rows and then the user, so an FK here would make
  // deleting any admin who had ever saved these settings fail on a constraint
  // violation. A stale id is a much smaller problem than an undeletable account.
  updatedBy: text("updated_by"),
});

// In-house recruitment applications table. One active application per user per cycle.
// Holds candidate's chosen domains (JSON array up to 2), year of study, branch, WhatsApp phone,
// answers to domain and wrapping-up questions (JSON object), review status, and reviewer notes.
export const recruitmentApplications = sqliteTable(
  "recruitment_applications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    cycle: text("cycle").notNull(),
    domains: text("domains").notNull(), // JSON string[] (e.g. ["Technical", "Design"])
    yearOfStudy: text("year_of_study").notNull(), // '1st' | '2nd' | '3rd' | '4th'
    branch: text("branch").notNull(),
    phone: text("phone").notNull(),
    heardFrom: text("heard_from"),
    responses: text("responses").notNull(), // JSON Record<string, any>
    status: text("status").notNull().default("submitted"), // "submitted" | "under_review" | "shortlisted" | "rejected" | "accepted"
    reviewerNotes: text("reviewer_notes"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [unique().on(t.userId, t.cycle)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type PasswordReset = typeof passwordResets.$inferSelect;
// Named *Row to avoid clashing with the domain `Challenge` type in @/lib/challenges.
export type ChallengeRow = typeof challenges.$inferSelect;
export type NewChallengeRow = typeof challenges.$inferInsert;
export type MonstrContest = typeof monstrContests.$inferSelect;
export type NewMonstrContest = typeof monstrContests.$inferInsert;
export type MonstrProblem = typeof monstrProblems.$inferSelect;
export type NewMonstrProblem = typeof monstrProblems.$inferInsert;
export type MonstrParticipant = typeof monstrParticipants.$inferSelect;
export type MonstrSubmission = typeof monstrSubmissions.$inferSelect;
export type NewMonstrSubmission = typeof monstrSubmissions.$inferInsert;
export type RecruitmentSettingsRow = typeof recruitmentSettings.$inferSelect;
export type NewRecruitmentSettingsRow = typeof recruitmentSettings.$inferInsert;
export type RecruitmentApplication = typeof recruitmentApplications.$inferSelect;
export type NewRecruitmentApplication = typeof recruitmentApplications.$inferInsert;

// ───────────────────────────── AlgoHunt 2.0 ─────────────────────────────
// All tables prefixed ah_. Timestamps are epoch milliseconds from the server clock.
// JSON columns are TEXT. Columns marked SECRET must never reach a participant response.
export const ahEvents = sqliteTable("ah_events", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isTest: integer("is_test", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("DRAFT"),
  maxTeamSize: integer("max_team_size").notNull().default(4),
  rankingMode: text("ranking_mode").notNull().default("SOLVED_THEN_TIME"),
  leaderboardVisible: integer("leaderboard_visible", { mode: "boolean" }).notNull().default(true),
  submissionsEnabled: integer("submissions_enabled", { mode: "boolean" }).notNull().default(true),
  codesEnabled: integer("codes_enabled", { mode: "boolean" }).notNull().default(true),
  startedAt: integer("started_at"),
  pausedAt: integer("paused_at"),
  endedAt: integer("ended_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const ahTeams = sqliteTable("ah_teams", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  teamCode: text("team_code").notNull(),
  teamName: text("team_name").notNull(),
  college: text("college"),
  passwordHash: text("password_hash").notNull(), // SECRET
  sessionEpoch: integer("session_epoch").notNull().default(0),
  status: text("status").notNull().default("REGISTERED"),
  checkedInAt: integer("checked_in_at"),
  finishedAt: integer("finished_at"),
  disqualifiedAt: integer("disqualified_at"),
  disqualificationReason: text("disqualification_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  unique("ah_teams_event_code_unique").on(t.eventId, t.teamCode),
  unique("ah_teams_event_name_unique").on(t.eventId, t.teamName),
  index("ah_teams_event_idx").on(t.eventId),
]);

export const ahTeamMembers = sqliteTable("ah_team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => ahTeams.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  isCaptain: integer("is_captain", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("ah_team_members_team_idx").on(t.teamId)]);

export const ahChallenges = sqliteTable("ah_challenges", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull().default("Unrated"),
  statement: text("statement").notNull(),
  inputFormat: text("input_format"),
  outputFormat: text("output_format"),
  constraints: text("constraints"),
  samples: text("samples").notNull().default("[]"),
  contentHtml: text("content_html"),
  checker: text("checker").notNull().default('{"type":"token"}'),
  timeLimit: text("time_limit").notNull().default("2s"),
  memoryLimit: text("memory_limit").notNull().default("256MB"),
  languages: text("languages"),
  referenceSolution: text("reference_solution"), // SECRET
  bruteSolution: text("brute_solution"), // SECRET
  editorial: text("editorial"), // SECRET
  author: text("author"), // SECRET
  verifiedAt: integer("verified_at"),
  sourceSha256: text("source_sha256"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [unique("ah_challenges_event_slug_unique").on(t.eventId, t.slug)]);

export const ahTestCases = sqliteTable("ah_test_cases", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull().references(() => ahChallenges.id),
  idx: integer("idx").notNull(),
  input: text("input").notNull(), // SECRET
  output: text("output").notNull(), // SECRET
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
}, (t) => [unique("ah_test_cases_challenge_idx_unique").on(t.challengeId, t.idx)]);

export const ahStages = sqliteTable("ah_stages", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  stageNumber: integer("stage_number").notNull(),
  challengeId: text("challenge_id").notNull().references(() => ahChallenges.id),
  points: integer("points").notNull().default(100),
  isFinal: integer("is_final", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  unique("ah_stages_event_number_unique").on(t.eventId, t.stageNumber),
  unique("ah_stages_event_challenge_unique").on(t.eventId, t.challengeId),
]);

export const ahStageProgress = sqliteTable("ah_stage_progress", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  teamId: text("team_id").notNull().references(() => ahTeams.id),
  stageId: text("stage_id").notNull().references(() => ahStages.id),
  challengeSolved: integer("challenge_solved", { mode: "boolean" }).notNull().default(false),
  challengeSolvedAt: integer("challenge_solved_at"),
  solvedSubmissionId: text("solved_submission_id"),
  codeRedeemed: integer("code_redeemed", { mode: "boolean" }).notNull().default(false),
  codeRedeemedAt: integer("code_redeemed_at"),
  redeemedCodeId: text("redeemed_code_id"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at"),
  completionRequestId: text("completion_request_id"),
  manualOverride: integer("manual_override", { mode: "boolean" }).notNull().default(false),
  overrideReason: text("override_reason"),
  overrideBy: text("override_by"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  unique("ah_stage_progress_team_stage_unique").on(t.teamId, t.stageId),
  index("ah_stage_progress_team_idx").on(t.teamId),
  index("ah_stage_progress_event_idx").on(t.eventId),
]);

export const ahSubmissions = sqliteTable("ah_submissions", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  teamId: text("team_id").notNull().references(() => ahTeams.id),
  stageId: text("stage_id").notNull().references(() => ahStages.id),
  challengeId: text("challenge_id").notNull().references(() => ahChallenges.id),
  language: text("language").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull().default("QUEUED"),
  verdict: text("verdict"),
  passed: integer("passed"),
  total: integer("total"),
  failedOn: integer("failed_on"),
  detail: text("detail"),
  runtimeMs: integer("runtime_ms"),
  clientRequestId: text("client_request_id"),
  createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"),
}, (t) => [
  unique("ah_submissions_team_request_unique").on(t.teamId, t.clientRequestId),
  index("ah_submissions_team_created_idx").on(t.teamId, t.createdAt),
  index("ah_submissions_event_created_idx").on(t.eventId, t.createdAt),
]);

export const ahCodeBatches = sqliteTable("ah_code_batches", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("ah_code_batches_event_idx").on(t.eventId)]);

export const ahCodes = sqliteTable("ah_codes", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  batchId: text("batch_id").notNull().references(() => ahCodeBatches.id),
  serial: integer("serial").notNull(),
  code: text("code").notNull(), // SECRET
  status: text("status").notNull().default("ACTIVE"),
  usedByTeamId: text("used_by_team_id"),
  usedAfterStageId: text("used_after_stage_id"),
  usedAt: integer("used_at"),
  disabledAt: integer("disabled_at"),
  disabledBy: text("disabled_by"),
  disabledReason: text("disabled_reason"),
  placementNote: text("placement_note"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  unique("ah_codes_code_unique").on(t.code),
  unique("ah_codes_event_serial_unique").on(t.eventId, t.serial),
  index("ah_codes_event_status_idx").on(t.eventId, t.status),
  index("ah_codes_used_by_idx").on(t.usedByTeamId),
]);

export const ahCodeAttempts = sqliteTable("ah_code_attempts", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  teamId: text("team_id").notNull().references(() => ahTeams.id),
  stageId: text("stage_id"),
  submittedCode: text("submitted_code"),
  result: text("result").notNull(),
  codeId: text("code_id"),
  ip: text("ip"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  index("ah_code_attempts_team_created_idx").on(t.teamId, t.createdAt),
  index("ah_code_attempts_event_created_idx").on(t.eventId, t.createdAt),
]);

export const ahVolunteers = sqliteTable("ah_volunteers", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  userId: text("user_id").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
}, (t) => [unique("ah_volunteers_event_user_unique").on(t.eventId, t.userId)]);

export const ahAnnouncements = sqliteTable("ah_announcements", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("INFO"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("ah_announcements_event_created_idx").on(t.eventId, t.createdAt)]);

export const ahDisqualifications = sqliteTable("ah_disqualifications", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => ahEvents.id),
  teamId: text("team_id").notNull().references(() => ahTeams.id),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  revokedAt: integer("revoked_at"),
  revokedBy: text("revoked_by"),
  revokeReason: text("revoke_reason"),
});

export const ahAuditLogs = sqliteTable("ah_audit_logs", {
  id: text("id").primaryKey(),
  eventId: text("event_id"),
  teamId: text("team_id"),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: text("metadata").notNull().default("{}"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  index("ah_audit_event_created_idx").on(t.eventId, t.createdAt),
  index("ah_audit_team_created_idx").on(t.teamId, t.createdAt),
]);

export type AhEvent = typeof ahEvents.$inferSelect;
export type NewAhEvent = typeof ahEvents.$inferInsert;
export type AhTeam = typeof ahTeams.$inferSelect;
export type NewAhTeam = typeof ahTeams.$inferInsert;
export type AhTeamMember = typeof ahTeamMembers.$inferSelect;
export type NewAhTeamMember = typeof ahTeamMembers.$inferInsert;
export type AhChallenge = typeof ahChallenges.$inferSelect;
export type NewAhChallenge = typeof ahChallenges.$inferInsert;
export type AhTestCase = typeof ahTestCases.$inferSelect;
export type NewAhTestCase = typeof ahTestCases.$inferInsert;
export type AhStage = typeof ahStages.$inferSelect;
export type NewAhStage = typeof ahStages.$inferInsert;
export type AhStageProgress = typeof ahStageProgress.$inferSelect;
export type NewAhStageProgress = typeof ahStageProgress.$inferInsert;
export type AhSubmission = typeof ahSubmissions.$inferSelect;
export type NewAhSubmission = typeof ahSubmissions.$inferInsert;
export type AhCodeBatch = typeof ahCodeBatches.$inferSelect;
export type NewAhCodeBatch = typeof ahCodeBatches.$inferInsert;
export type AhCode = typeof ahCodes.$inferSelect;
export type NewAhCode = typeof ahCodes.$inferInsert;
export type AhCodeAttempt = typeof ahCodeAttempts.$inferSelect;
export type NewAhCodeAttempt = typeof ahCodeAttempts.$inferInsert;
export type AhVolunteer = typeof ahVolunteers.$inferSelect;
export type NewAhVolunteer = typeof ahVolunteers.$inferInsert;
export type AhAnnouncement = typeof ahAnnouncements.$inferSelect;
export type NewAhAnnouncement = typeof ahAnnouncements.$inferInsert;
export type AhDisqualification = typeof ahDisqualifications.$inferSelect;
export type NewAhDisqualification = typeof ahDisqualifications.$inferInsert;
export type AhAuditLog = typeof ahAuditLogs.$inferSelect;
export type NewAhAuditLog = typeof ahAuditLogs.$inferInsert;
