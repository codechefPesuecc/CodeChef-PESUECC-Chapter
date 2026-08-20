import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import {
  monstrParticipants,
  monstrProblems,
  monstrContests,
  monstrSubmissions,
} from "@/server/db/schema";
import { PISTON_LANGUAGE } from "@/lib/piston";
import { monstrJudge } from "@/server/judge";
import { rateLimit } from "@/server/rateLimit";
import { bodyTooLarge, tooLong, MAX_CODE_CHARS } from "@/server/limits";

export const dynamic = "force-dynamic";

const SUBMIT_LIMIT = 20;
const SUBMIT_WINDOW_MS = 60_000;

/**
 * Submit code for grading against hidden tests.
 * Enforces: user is logged in, joined, contest is active, time hasn't expired.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in to submit.", needsAuth: true },
      { status: 401 },
    );
  }

  const limit = await rateLimit(`monstr:submit:user:${user.id}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
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
    problemId?: string;
    language?: string;
    code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { problemId, language, code } = body;
  if (!problemId || !language || typeof code !== "string") {
    return NextResponse.json(
      { ok: false, error: "problemId, language, and code are required." },
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

  try {
    const db = getDb();

    // Verify participant
    const participantRows = await db
      .select()
      .from(monstrParticipants)
      .where(
        and(
          eq(monstrParticipants.contestId, id),
          eq(monstrParticipants.userId, user.id),
        ),
      )
      .limit(1);

    if (!participantRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Not joined." },
        { status: 403 },
      );
    }

    // Get contest and check timing
    const contestRows = await db
      .select()
      .from(monstrContests)
      .where(eq(monstrContests.id, id))
      .limit(1);

    if (!contestRows[0] || !contestRows[0].startedAt) {
      return NextResponse.json(
        { ok: false, error: "Contest not started." },
        { status: 403 },
      );
    }

    const contest = contestRows[0];
    const now = Date.now();

    // Check time limit
    if (contest.endsAt && now > contest.endsAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Contest has ended.",
          contestEnded: true,
        },
        { status: 403 },
      );
    }

    // Verify language is allowed
    const allowedLanguages = JSON.parse(contest.allowedLanguages);
    if (!allowedLanguages.includes(language)) {
      return NextResponse.json(
        { ok: false, error: `Language ${language} is not allowed for this contest.` },
        { status: 400 },
      );
    }

    // Get problem and verify it belongs to contest
    const problemRows = await db
      .select()
      .from(monstrProblems)
      .where(
        and(
          eq(monstrProblems.id, problemId),
          eq(monstrProblems.contestId, id),
        ),
      )
      .limit(1);

    if (!problemRows[0]) {
      return NextResponse.json(
        { ok: false, error: "Problem not found." },
        { status: 404 },
      );
    }

    const problem = problemRows[0];

    // Judge the submission
    const judgeResult = await monstrJudge({
      problem,
      language,
      code,
    });

    if (judgeResult.verdict === "ERR") {
      return NextResponse.json(
        { ok: false, error: judgeResult.message ?? "Judge error." },
        { status: 503 },
      );
    }

    // Record submission
    const submissionId = crypto.randomUUID();
    await db.insert(monstrSubmissions).values({
      id: submissionId,
      contestId: id,
      problemId,
      userId: user.id,
      language,
      code,
      status: judgeResult.verdict,
      runtimeMs: null,
      createdAt: now,
    });

    return NextResponse.json({
      ok: true,
      verdict: judgeResult.verdict,
      passed: judgeResult.passed,
      total: judgeResult.total,
      failedOn: judgeResult.failedOn,
      detail: judgeResult.detail,
    });
  } catch (error) {
    console.error("[api/monstr/contests/[id]/submit] error:", error);
    return NextResponse.json(
      { ok: false, error: "Submission failed." },
      { status: 500 },
    );
  }
}
