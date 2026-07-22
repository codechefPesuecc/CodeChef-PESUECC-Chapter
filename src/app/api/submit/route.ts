import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { getDailyChallenge } from "@/lib/challenges";
import { judge } from "@/server/judge";
import { rateLimit, clientIp } from "@/server/rateLimit";
import { verifyTurnstile } from "@/server/turnstile";

export const dynamic = "force-dynamic";

// Turn on once an email provider is configured (see AUTH docs).
const REQUIRE_VERIFIED = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

// Per-user submission cap — the FIFO judge queue bounds throughput, this bounds
// spam per account before it ever reaches the queue.
const SUBMIT_LIMIT = 20;
const SUBMIT_WINDOW_MS = 60_000;

/**
 * Graded submission: requires login, runs the code against the hidden tests, and
 * records the result server-side (which is what makes the leaderboard real and
 * the solve time unspoofable). Hidden test data never leaves the server.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in to submit.", needsAuth: true },
      { status: 401 },
    );
  }
  if (REQUIRE_VERIFIED && !user.emailVerified) {
    return NextResponse.json(
      { ok: false, error: "Verify your email before submitting.", needsVerify: true },
      { status: 403 },
    );
  }

  const limit = rateLimit(`submit:${user.id}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many submissions — try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
        rateLimited: true,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: {
    slug?: string;
    language?: string;
    code?: string;
    elapsedSeconds?: number;
    flags?: number;
    flagsBreakdown?: unknown;
    turnstileToken?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { slug, language, code } = body;
  if (!slug || !language || typeof code !== "string") {
    return NextResponse.json(
      { ok: false, error: "slug, language and code are required." },
      { status: 400 },
    );
  }

  // Bot check (no-op unless TURNSTILE_SECRET_KEY is configured).
  const turnstile = await verifyTurnstile(body.turnstileToken, clientIp(req));
  if (!turnstile.ok) {
    return NextResponse.json(
      { ok: false, error: turnstile.error, needsTurnstile: true },
      { status: 403 },
    );
  }

  // Only the current Problem of the Day is ranked. Past problems are practice:
  // they're judged for AC/WA feedback but not recorded, so re-solving an old
  // problem at leisure can't mint fresh speed-bounty points or move the boards.
  const daily = getDailyChallenge();
  const ranked = daily?.slug === slug;

  const result = await judge({ slug, language, code });

  if (result.verdict === "ERR") {
    return NextResponse.json({ ok: false, error: result.message ?? "Judge error." }, { status: 503 });
  }

  // Record every ranked judged submission (audit trail + leaderboard source).
  if (ranked) {
    try {
      await db.insert(submissions).values({
        id: crypto.randomUUID(),
        challengeSlug: slug,
        userId: user.id,
        language,
        code,
        status: result.verdict,
        elapsedSeconds:
          typeof body.elapsedSeconds === "number" ? Math.round(body.elapsedSeconds) : null,
        flags: typeof body.flags === "number" ? Math.max(0, Math.round(body.flags)) : 0,
        flagsBreakdown: body.flagsBreakdown ? JSON.stringify(body.flagsBreakdown) : null,
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error("[submit] failed to record submission:", error);
    }
  }

  return NextResponse.json({ ok: true, practice: !ranked, ...result });
}
