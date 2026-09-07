import { and, desc, eq, ne, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { submissions, users } from "@/server/db/schema";
import { getChallengeTitles } from "@/lib/challenges";
import { aggregateLeaderboard } from "@/server/leaderboard";

/**
 * Profile data for a signed-in user: their recorded submission history plus their
 * standing on the aggregate boards. Ranked (live Problem-of-the-Day) submissions
 * are recorded in full; accepted practice solves on past problems are also kept
 * (they earn the flat base score).
 */

export interface ProfileSubmission {
  id: string;
  slug: string;
  title: string;
  language: string;
  status: string;
  elapsedSeconds: number | null;
  flags: number;
  createdAt: number;
}

export interface ProfileStats {
  allPoints: number;
  allRank: number | null;
  monthPoints: number;
  monthRank: number | null;
  solved: number;
  submissions: number;
}

/** Every recorded submission for a user, newest first. */
export async function getUserSubmissions(
  userId: string,
): Promise<ProfileSubmission[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: submissions.id,
      slug: submissions.challengeSlug,
      language: submissions.language,
      status: submissions.status,
      elapsedSeconds: submissions.elapsedSeconds,
      flags: submissions.flags,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt));

  // One batched title lookup instead of a per-row query.
  const titles = await getChallengeTitles([...new Set(rows.map((r) => r.slug))]);
  return rows.map((r) => ({
    ...r,
    title: titles.get(r.slug) ?? r.slug,
  }));
}

/** A user's points/rank/solved on the month and all-time boards. */
export async function getProfileStats(
  identity: string,
  submissionCount: number,
): Promise<ProfileStats> {
  const [all, month] = await Promise.all([
    aggregateLeaderboard("all"),
    aggregateLeaderboard("month"),
  ]);
  // The boards are keyed by username; match on that identity.
  const a = all.find((r) => r.display === identity);
  const m = month.find((r) => r.display === identity);
  return {
    allPoints: a?.points ?? 0,
    allRank: a?.rank ?? null,
    monthPoints: m?.points ?? 0,
    monthRank: m?.rank ?? null,
    solved: a?.solved ?? 0,
    submissions: submissionCount,
  };
}

/**
 * Self-service identity edits from /profile. Students register before their SRN is
 * assigned (first years get only a PRN), and typos in a roll number are otherwise
 * permanent — this lets them correct their own record. Email is deliberately not
 * editable here: it is tied to the OTP verification flow.
 */

// Same rule the register + admin-create routes enforce, so an edited handle stays
// comparable to a registered one.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const MAX_ROLL_LEN = 32;

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export interface ProfileInput {
  name?: unknown;
  username?: unknown;
  srn?: unknown;
  prn?: unknown;
}

/**
 * Applies the fields that were actually sent (so a partial PATCH works), after
 * normalizing them exactly as registration does — lowercase username, uppercase
 * roll numbers — and re-checking the three unique columns against every *other*
 * user. Returns a discriminated result rather than throwing, matching `deleteUser`.
 */
export async function updateProfile(
  userId: string,
  input: ProfileInput,
): Promise<UpdateProfileResult> {
  const patch: {
    name?: string;
    username?: string;
    srn?: string | null;
    prn?: string;
  } = {};

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (name.length < 1 || name.length > 80) {
      return { ok: false, status: 400, error: "Enter your name (up to 80 characters)." };
    }
    patch.name = name;
  }

  if (input.username !== undefined) {
    const username = String(input.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return {
        ok: false,
        status: 400,
        error: "Username must be 3–20 characters: lowercase letters, numbers, underscore.",
      };
    }
    patch.username = username;
  }

  if (input.prn !== undefined) {
    const prn = String(input.prn).trim().toUpperCase();
    if (!prn) return { ok: false, status: 400, error: "PRN is required." };
    if (prn.length > MAX_ROLL_LEN) {
      return { ok: false, status: 400, error: "That PRN is too long." };
    }
    patch.prn = prn;
  }

  if (input.srn !== undefined) {
    // An empty field clears the SRN back to null — the column is nullable and SQLite
    // treats NULLs as distinct, so many users can be without one.
    const raw = String(input.srn).trim().toUpperCase();
    if (raw.length > MAX_ROLL_LEN) {
      return { ok: false, status: 400, error: "That SRN is too long." };
    }
    patch.srn = raw || null;
  }

  // No format check on SRN/PRN beyond length: the codebase has never validated their
  // shape, so existing rows may not match any pattern we'd invent here — re-validating
  // an untouched value would block otherwise-valid saves.

  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, error: "Nothing to update." };
  }

  const db = getDb();

  // Pre-check the unique columns for a friendly message, excluding this user's own
  // row — without the `ne`, every save would collide with itself.
  const conditions = [];
  if (patch.username !== undefined) conditions.push(eq(users.username, patch.username));
  if (patch.prn !== undefined) conditions.push(eq(users.prn, patch.prn));
  if (patch.srn) conditions.push(eq(users.srn, patch.srn));

  if (conditions.length > 0) {
    const clashes = await db
      .select({ username: users.username, prn: users.prn, srn: users.srn })
      .from(users)
      .where(and(ne(users.id, userId), or(...conditions)));
    const c = clashes[0];
    if (c) {
      const error =
        c.username === patch.username
          ? "That username is taken."
          : c.prn === patch.prn
            ? "An account with that PRN already exists."
            : "An account with that SRN already exists.";
      return { ok: false, status: 409, error };
    }
  }

  try {
    await db.update(users).set(patch).where(eq(users.id, userId));
  } catch {
    // Backstop for the race between the pre-check and the write.
    return {
      ok: false,
      status: 409,
      error: "Those details are already used by another account.",
    };
  }

  return { ok: true };
}
