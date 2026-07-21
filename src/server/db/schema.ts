import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * CP Arena persistence (SQLite via libSQL / Drizzle).
 *
 * Challenges still live as GitOps markdown (see src/lib/challenges.ts); the DB
 * holds the dynamic state — who solved what, when, and how. Timestamps are unix
 * epoch milliseconds recorded server-side, so solve ordering can't be spoofed
 * by the client.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name"),
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
