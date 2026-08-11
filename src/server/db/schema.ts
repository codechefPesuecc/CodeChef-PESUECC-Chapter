import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

/**
 * Arena persistence (SQLite via libSQL / Drizzle).
 *
 * Challenges live as GitOps JSON; the DB holds accounts and the dynamic state —
 * who solved what, when, and how. Timestamps are unix epoch milliseconds recorded
 * server-side, so solve ordering can't be spoofed by the client. Sessions are
 * stateless signed cookies, so there's no sessions table.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  // Public leaderboard identity; SRN/PRN/email stay private.
  username: text("username").notNull().unique(),
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
  // Client-reported solve duration (indicative). Official ordering uses createdAt.
  elapsedSeconds: integer("elapsed_seconds"),
  // Integrity signals captured client-side for review.
  flags: integer("flags").notNull().default(0),
  flagsBreakdown: text("flags_breakdown"),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type PasswordReset = typeof passwordResets.$inferSelect;
