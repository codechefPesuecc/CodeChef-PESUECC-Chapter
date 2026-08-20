import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests, monstrParticipants } from "@/server/db/schema";
import { rateLimit, clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const JOIN_LIMIT = 10;
const JOIN_WINDOW_MS = 60_000;

/**
 * Join a Monstr contest by code.
 * Requires: logged-in user with verified email and SRN.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in to join.", needsAuth: true },
      { status: 401 },
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { ok: false, error: "Verify your email first.", needsVerify: true },
      { status: 403 },
    );
  }

  if (!user.srn) {
    return NextResponse.json(
      { ok: false, error: "SRN is required to join Monstr contests.", needsSrn: true },
      { status: 403 },
    );
  }

  const limit = await rateLimit(`monstr:join:user:${user.id}`, JOIN_LIMIT, JOIN_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many join attempts — try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
        rateLimited: true,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { code } = body;
  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { ok: false, error: "Join code is required." },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const normalizedCode = code.trim().toUpperCase();

    // Look up contest by join code
    const contestRows = await db
      .select({ id: monstrContests.id })
      .from(monstrContests)
      .where(eq(monstrContests.joinCode, normalizedCode))
      .limit(1);

    if (!contestRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Invalid join code." },
        { status: 404 },
      );
    }

    const contestId = contestRows[0].id;

    // Upsert participant (if already joined, this is a no-op)
    await db
      .insert(monstrParticipants)
      .values({
        id: crypto.randomUUID(),
        contestId,
        userId: user.id,
        joinedAt: Date.now(),
      })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true, contestId });
  } catch (error) {
    console.error("[api/monstr/join] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to join contest." },
      { status: 500 },
    );
  }
}
