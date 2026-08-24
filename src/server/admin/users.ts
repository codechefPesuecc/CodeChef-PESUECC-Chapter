import { desc, eq, like, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  users,
  submissions,
  attempts,
  emailVerifications,
  passwordResets,
  monstrContests,
  monstrParticipants,
  monstrSubmissions,
} from "@/server/db/schema";

/** Safe user projection for the admin console — never includes the password hash. */
export interface AdminUserRow {
  id: string;
  username: string;
  name: string | null;
  email: string;
  prn: string;
  srn: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  createdAt: number;
}

const SAFE_COLUMNS = {
  id: users.id,
  username: users.username,
  name: users.name,
  email: users.email,
  prn: users.prn,
  srn: users.srn,
  emailVerified: users.emailVerified,
  isAdmin: users.isAdmin,
  isTeacher: users.isTeacher,
  createdAt: users.createdAt,
};

/** Every user (newest first), or those matching a search term across
 * username/name/email/prn/srn. Capped so one query can't return the whole table. */
export async function listAllUsers(q?: string): Promise<AdminUserRow[]> {
  const db = getDb();
  const base = db.select(SAFE_COLUMNS).from(users);
  const term = q?.trim();
  const rows = term
    ? await base
        .where(
          or(
            like(users.username, `%${term}%`),
            like(users.name, `%${term}%`),
            like(users.email, `%${term}%`),
            like(users.prn, `%${term}%`),
            like(users.srn, `%${term}%`),
          ),
        )
        .orderBy(desc(users.createdAt))
        .limit(200)
    : await base.orderBy(desc(users.createdAt)).limit(500);
  return rows;
}

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Permanently deletes a user and all of their solve/auth/contest-participation
 * rows (the schema has no ON DELETE CASCADE, so children are removed explicitly).
 * Blocks if the user OWNS Monstr contests — one click shouldn't wipe an entire
 * contest's problems and everyone's submissions; the admin deletes those first.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const db = getDb();

  const owned = await db
    .select({ id: monstrContests.id })
    .from(monstrContests)
    .where(eq(monstrContests.teacherId, userId))
    .limit(1);
  if (owned[0]) {
    return {
      ok: false,
      status: 409,
      error:
        "This user owns Monstr contests. Delete those contests first, then remove the user.",
    };
  }

  // Children first, then the user itself.
  await db.delete(monstrSubmissions).where(eq(monstrSubmissions.userId, userId));
  await db.delete(monstrParticipants).where(eq(monstrParticipants.userId, userId));
  await db.delete(submissions).where(eq(submissions.userId, userId));
  await db.delete(attempts).where(eq(attempts.userId, userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  return { ok: true };
}
