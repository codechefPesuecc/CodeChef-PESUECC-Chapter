import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { judge } from "@/server/judge";

export const dynamic = "force-dynamic";

// Turn on once an email provider is configured (see AUTH docs).
const REQUIRE_VERIFIED = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

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

  let body: {
    slug?: string;
    language?: string;
    code?: string;
    elapsedSeconds?: number;
    flags?: number;
    flagsBreakdown?: unknown;
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

  const result = await judge({ slug, language, code });

  if (result.verdict === "ERR") {
    return NextResponse.json({ ok: false, error: result.message ?? "Judge error." }, { status: 503 });
  }

  // Record every judged submission (audit trail + leaderboard source).
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

  return NextResponse.json({ ok: true, ...result });
}
