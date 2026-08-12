import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { submissions, attempts } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { getDailyChallenge } from "@/lib/challenges";
import { judge } from "@/server/judge";
import { rateLimit, clientIp } from "@/server/rateLimit";
import { verifyTurnstile } from "@/server/turnstile";
import { PISTON_LANGUAGE } from "@/lib/piston";
import {
  bodyTooLarge,
  tooLong,
  MAX_CODE_CHARS,
  MAX_FLAGS_BREAKDOWN_CHARS,
} from "@/server/limits";

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

  const limit = await rateLimit(`submit:user:${user.id}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
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

  const oversize = bodyTooLarge(req);
  if (oversize) return oversize;

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

  const codeTooLong = tooLong(code, MAX_CODE_CHARS, "Code");
  if (codeTooLong) return codeTooLong;
  if (!PISTON_LANGUAGE[language]) {
    return NextResponse.json(
      { ok: false, error: `Unsupported language: ${language}.` },
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

  // The official solve time is server-authoritative: the submit time minus the
  // first-open time recorded in `attempts` — never the client's stopwatch.
  const submittedAt = Date.now();
  let elapsedSeconds: number | null = null;

  // Record every ranked judged submission (audit trail + leaderboard source).
  if (ranked) {
    const db = getDb();
    try {
      const startRows = await db
        .select({ startedAt: attempts.startedAt })
        .from(attempts)
        .where(and(eq(attempts.userId, user.id), eq(attempts.challengeSlug, slug)))
        .limit(1);
      const startedAt = startRows[0]?.startedAt;
      if (typeof startedAt === "number") {
        elapsedSeconds = Math.max(0, Math.round((submittedAt - startedAt) / 1000));
      }
    } catch (error) {
      console.error("[submit] failed to read attempt start:", error);
    }

    // Client-supplied integrity detail is diagnostic only; drop it if it's
    // oversized rather than storing an unbounded blob.
    const rawBreakdown =
      body.flagsBreakdown != null ? JSON.stringify(body.flagsBreakdown) : null;
    const flagsBreakdown =
      rawBreakdown && rawBreakdown.length <= MAX_FLAGS_BREAKDOWN_CHARS
        ? rawBreakdown
        : null;

    try {
      await db.insert(submissions).values({
        id: crypto.randomUUID(),
        challengeSlug: slug,
        userId: user.id,
        language,
        code,
        status: result.verdict,
        elapsedSeconds,
        flags: typeof body.flags === "number" ? Math.max(0, Math.round(body.flags)) : 0,
        flagsBreakdown,
        createdAt: submittedAt,
      });
    } catch (error) {
      console.error("[submit] failed to record submission:", error);
    }
  }

  return NextResponse.json({ ok: true, practice: !ranked, ...result, elapsedSeconds });
}
