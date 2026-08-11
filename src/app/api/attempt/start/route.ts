import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { attempts } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { getDailyChallenge } from "@/lib/challenges";

export const dynamic = "force-dynamic";

/**
 * Starts (or reads) a candidate's server-authoritative solve clock for today's
 * ranked Problem of the Day. Called when the workspace opens the problem.
 *
 * - The clock begins the **first time** the problem is opened and is then
 *   immutable (`onConflictDoNothing` on the unique `(user, challenge)` index),
 *   so it can't be reset to shrink a solve time and it survives reloads / a
 *   device switch — the returned `startedAt` seeds the live timer everywhere.
 * - Only today's POTD records a start. Past-problem practice no-ops (`ranked:
 *   false`), so it never earns a time or points.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, needsAuth: true }, { status: 401 });
  }

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug is required." }, { status: 400 });
  }

  // Only the current, ranked Problem of the Day starts a clock. Anything else
  // (a past problem opened for practice) is intentionally not tracked.
  const daily = getDailyChallenge();
  if (daily?.slug !== slug) {
    return NextResponse.json({ ok: true, ranked: false, startedAt: null });
  }

  const db = getDb();
  const now = Date.now();

  // First open wins; subsequent opens leave the original start untouched.
  await db
    .insert(attempts)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      challengeSlug: slug,
      startedAt: now,
    })
    .onConflictDoNothing({
      target: [attempts.userId, attempts.challengeSlug],
    });

  const rows = await db
    .select({ startedAt: attempts.startedAt })
    .from(attempts)
    .where(and(eq(attempts.userId, user.id), eq(attempts.challengeSlug, slug)))
    .limit(1);

  return NextResponse.json({
    ok: true,
    ranked: true,
    startedAt: rows[0]?.startedAt ?? now,
  });
}
