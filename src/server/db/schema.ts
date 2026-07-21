import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
