import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

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
  date: text("date").notNull(), // YYYY-MM-DD (IST) — the release key
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
});

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
