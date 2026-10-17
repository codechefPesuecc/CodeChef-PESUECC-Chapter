/**
 * AlgoHunt submission server helpers (Module 2).
 * Handles creating, judging, and listing submissions.
 */
import { and, desc, eq, lt, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahStages, ahSubmissions, type AhSubmission } from "@/server/db/schema";
import type { SubmissionView, SubmitResult, ErrorCode } from "@/lib/algohunt/types";
import { judgeTests } from "@/server/judge";
import { JUDGE_LANGUAGE } from "@/lib/judge";
import { COPY } from "@/lib/algohunt/copy";
import type { TeamContext } from "./teamSession";
import { getTeamProgress, assertTeamCanPlay } from "./access";
import { getStageChallenge, loadJudgeInput, allowedLanguages } from "./challenges";
import { recordChallengeSolved } from "./progression";
import { writeAudit } from "./audit";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a SubmissionView from an AhSubmission row. */
export function toSubmissionView(row: AhSubmission, stageNumber: number): SubmissionView {
  // detail is only returned for DONE rows with CE or RE
  const showDetail =
    row.status === "DONE" &&
    (row.verdict === "CE" || row.verdict === "RE");
  return {
    id: row.id,
    stageNumber,
    language: row.language,
    status: row.status as SubmissionView["status"],
    verdict: row.verdict as SubmissionView["verdict"] ?? null,
    passed: row.passed,
    total: row.total,
    failedOn: row.failedOn,
    detail: showDetail ? row.detail : null,
    runtimeMs: row.runtimeMs,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────

/** A RUNNING row older than this is treated as abandoned (the request died mid-judge) and may be retried. */
const STALE_RUNNING_MS = 90_000;

/** Insert unless the team already sent this clientRequestId. Returns false on that conflict. */
async function insertSubmission(row: AhSubmission): Promise<boolean> {
  const inserted = await getDb().insert(ahSubmissions).values(row)
    .onConflictDoNothing({ target: [ahSubmissions.teamId, ahSubmissions.clientRequestId] })
    .returning({ id: ahSubmissions.id });
  return inserted.length > 0;
}

async function getSubmissionByRequestId(teamId: string, clientRequestId: string): Promise<AhSubmission | null> {
  const [row] = await getDb().select().from(ahSubmissions)
    .where(and(eq(ahSubmissions.teamId, teamId), eq(ahSubmissions.clientRequestId, clientRequestId)))
    .limit(1);
  return row ?? null;
}

async function updateSubmission(
  id: string,
  fields: Partial<Pick<AhSubmission,
    "status" | "verdict" | "passed" | "total" | "failedOn" | "detail" | "runtimeMs" | "finishedAt">>,
): Promise<void> {
  await getDb().update(ahSubmissions).set(fields).where(eq(ahSubmissions.id, id));
}

/** Take a FAILED (or abandoned RUNNING) row back for a retry. Only one retry can win it. */
async function reclaimSubmission(id: string, now: number): Promise<boolean> {
  const rows = await getDb().update(ahSubmissions).set({ status: "RUNNING" })
    .where(and(
      eq(ahSubmissions.id, id),
      or(
        eq(ahSubmissions.status, "FAILED"),
        and(eq(ahSubmissions.status, "RUNNING"), lt(ahSubmissions.createdAt, now - STALE_RUNNING_MS)),
      ),
    ))
    .returning({ id: ahSubmissions.id });
  return rows.length > 0;
}

// ── Core functions ─────────────────────────────────────────────────────────

/**
 * Create a submission, judge it synchronously via Akiro, update the DB,
 * and return the SubmitResult.
 *
 * Algorithm per contract §4.2:
 * 1. assertTeamCanPlay → block if not allowed
 * 2. getTeamProgress → get current question
 * 3. Language check
 * 4. Idempotent insert via ON CONFLICT DO NOTHING
 * 5. Judge via Akiro (judgeTests)
 * 6. Update submission row
 * 7. recordChallengeSolved if AC
 * 8. Build SubmitResult
 */
export async function createAndJudgeSubmission(p: {
  ctx: TeamContext;
  language: string;
  code: string;
  clientRequestId: string;
  ip: string;
}): Promise<{ ok: true; result: SubmitResult } | { ok: false; code: ErrorCode; message?: string }> {
  const { ctx, clientRequestId } = p;
  const { team, event } = ctx;

  // Step 1: assertTeamCanPlay
  const block = assertTeamCanPlay(ctx, "submit");
  if (block) {
    return { ok: false, code: block.code, message: block.message };
  }

  // Step 2: getTeamProgress → current question
  const progress = await getTeamProgress(ctx);
  const cur = progress.current;
  if (!cur) {
    if (progress.finished) {
      return { ok: false, code: "TEAM_FINISHED" };
    }
    return { ok: false, code: "EVENT_NOT_LIVE" };
  }
  if (!cur.stage.enabled) {
    return { ok: false, code: "STAGE_DISABLED" };
  }

  const now = Date.now();
  const existing = await getSubmissionByRequestId(team.id, clientRequestId);

  if (existing?.status === "DONE") {
    // A retry of a request that was already judged: replay its result. If it was the AC but the
    // solve never got recorded (the request died in between), record it now; that is idempotent.
    let finished = progress.finished;
    let solved = cur.progress?.challengeSolved === true;
    if (existing.verdict === "AC" && existing.stageId === cur.stage.id && !solved) {
      const eng = await recordChallengeSolved({ ctx, stageId: cur.stage.id, submissionId: existing.id });
      finished = eng.finished;
      solved = true;
    }
    const sameStage = existing.stageId === cur.stage.id;
    const challengeSolved = sameStage ? existing.verdict === "AC" || solved : true;
    return {
      ok: true,
      result: {
        submission: toSubmissionView(existing, cur.stage.stageNumber),
        stage: {
          number: cur.stage.stageNumber,
          challengeSolved,
          needsCode: challengeSolved && !cur.stage.isFinal && !finished,
          finished,
        },
        message: buildMessage(existing.verdict, existing.failedOn, finished),
      },
    };
  }

  if (cur.progress?.challengeSolved) {
    return {
      ok: false,
      code: "ALREADY_SOLVED",
      message: COPY.accepted,
    };
  }

  // Step 3: Language check
  const sc = await getStageChallenge(cur.stage.id);
  if (!sc) {
    return { ok: false, code: "INTERNAL", message: "Challenge data not found." };
  }

  let subRow: AhSubmission;
  if (existing) {
    // A retry of a request whose judging failed or was abandoned: judge the code it carried.
    if (existing.stageId !== cur.stage.id) {
      return { ok: false, code: "CONFLICT", message: "That submission was for an earlier question." };
    }
    if (!await reclaimSubmission(existing.id, now)) {
      return { ok: false, code: "CONFLICT", message: "This submission is still being judged." };
    }
    subRow = { ...existing, status: "RUNNING" };
  } else {
    // Step 4: Idempotent insert
    subRow = {
      id: crypto.randomUUID(),
      eventId: event.id,
      teamId: team.id,
      stageId: cur.stage.id,
      challengeId: sc.challenge.id,
      language: p.language,
      code: p.code,
      status: "RUNNING",
      verdict: null,
      passed: null,
      total: null,
      failedOn: null,
      detail: null,
      runtimeMs: null,
      clientRequestId,
      createdAt: now,
      finishedAt: null,
    };
    if (!await insertSubmission(subRow)) {
      // Lost a race with a parallel copy of the same request.
      return { ok: false, code: "CONFLICT", message: "This submission is still being judged." };
    }
  }

  const allowed = allowedLanguages(sc.challenge);
  const isAllowed = allowed.some((l) => l.id === subRow.language);
  if (!isAllowed || !JUDGE_LANGUAGE[subRow.language.toLowerCase()]) {
    await updateSubmission(subRow.id, { status: "FAILED", verdict: "ERR", detail: "unsupported language", finishedAt: Date.now() });
    return { ok: false, code: "UNSUPPORTED_LANGUAGE" };
  }

  try {
    return await judgeAndRecord({ ctx, cur, sc, subRow, started: now, finishedBefore: progress.finished });
  } catch (error) {
    // Never leave the row RUNNING: a retry with the same clientRequestId can then judge it again.
    await updateSubmission(subRow.id, { status: "FAILED", verdict: "ERR", detail: "internal error", finishedAt: Date.now() })
      .catch(() => undefined);
    throw error;
  }
}

async function judgeAndRecord(p: {
  ctx: TeamContext;
  cur: NonNullable<Awaited<ReturnType<typeof getTeamProgress>>["current"]>;
  sc: NonNullable<Awaited<ReturnType<typeof getStageChallenge>>>;
  subRow: AhSubmission;
  started: number;
  finishedBefore: boolean;
}): Promise<{ ok: true; result: SubmitResult } | { ok: false; code: ErrorCode; message?: string }> {
  const { ctx, cur, sc, subRow } = p;
  const { team, event } = ctx;

  // Step 5: Judge via Akiro
  const judgeInput = await loadJudgeInput(sc.challenge);
  if (judgeInput.tests.length === 0) {
    await updateSubmission(subRow.id, { status: "FAILED", verdict: "NO_TESTS", finishedAt: Date.now() });
    await writeAudit({
      eventId: event.id, teamId: team.id, actorType: "SYSTEM", actorId: null, action: "submission.judged",
      metadata: { verdict: "NO_TESTS", challengeId: sc.challenge.id },
    });
    return { ok: false, code: "INTERNAL" };
  }
  const res = await judgeTests({
    tests: judgeInput.tests,
    checker: judgeInput.checker,
    language: subRow.language,
    code: subRow.code,
    timeLimitMs: judgeInput.timeLimitMs,
    memLimitBytes: judgeInput.memLimitBytes,
  });

  const finishedAt = Date.now();
  const runtimeMs = finishedAt - p.started;

  // Step 6: Update the submission row by verdict
  if (res.verdict === "ERR" || res.verdict === "NO_TESTS") {
    await updateSubmission(subRow.id, {
      status: "FAILED",
      verdict: res.verdict,
      detail: res.message ?? null, // internal, never returned to team
      finishedAt,
    });
    return { ok: false, code: "JUDGE_UNAVAILABLE" };
  }

  // Compiler output is always safe to show. A program's stderr only when it failed on a sample,
  // since a hidden test's stderr could carry that test's input.
  const showDetail = res.verdict === "CE" || (res.failedOn !== undefined && res.failedOn <= judgeInput.sampleCount);
  const detail = showDetail && res.detail ? res.detail.slice(0, 4000) : null;
  await updateSubmission(subRow.id, {
    status: "DONE",
    verdict: res.verdict,
    passed: res.passed,
    total: res.total,
    failedOn: res.failedOn ?? null,
    detail,
    runtimeMs,
    finishedAt,
  });

  await writeAudit({
    eventId: event.id,
    teamId: team.id,
    actorType: "TEAM",
    actorId: team.id,
    action: "submission.judged",
    metadata: { verdict: res.verdict, challengeId: sc.challenge.id },
  });

  // Step 7: recordChallengeSolved if AC
  let finished = p.finishedBefore;
  if (res.verdict === "AC") {
    finished = (await recordChallengeSolved({ ctx, stageId: cur.stage.id, submissionId: subRow.id })).finished;
  }

  // Step 8: Build SubmitResult
  const challengeSolved = res.verdict === "AC";
  const finalRow: AhSubmission = {
    ...subRow,
    status: "DONE",
    verdict: res.verdict,
    passed: res.passed,
    total: res.total,
    failedOn: res.failedOn ?? null,
    detail,
    runtimeMs,
    finishedAt,
  };
  return {
    ok: true,
    result: {
      submission: toSubmissionView(finalRow, cur.stage.stageNumber),
      stage: {
        number: cur.stage.stageNumber,
        challengeSolved,
        needsCode: challengeSolved && !cur.stage.isFinal,
        finished,
      },
      message: buildMessage(res.verdict, res.failedOn, finished),
    },
  };
}

function buildMessage(
  verdict: string | null,
  failedOn: number | null | undefined,
  finished: boolean,
): string {
  if (finished) return COPY.finished;
  switch (verdict) {
    case "AC":
      return COPY.accepted;
    case "WA":
      return `Wrong answer on test ${failedOn ?? "?"}.`;
    case "TLE":
      return `Time limit exceeded on test ${failedOn ?? "?"}.`;
    case "MLE":
      return `Memory limit exceeded on test ${failedOn ?? "?"}.`;
    case "RE":
      return `Runtime error on test ${failedOn ?? "?"}.`;
    case "CE":
      return "Compilation error. See the details below.";
    default:
      return COPY.errors.INTERNAL;
  }
}

/**
 * List a team's submissions for their current question.
 * Returns newest first, max 50.
 */
export async function listTeamSubmissions(p: {
  teamId: string;
  stageId: string;
  limit?: number;
}): Promise<(SubmissionView & { code: string })[]> {
  const rows = await getDb().select({ submission: ahSubmissions, stageNumber: ahStages.stageNumber })
    .from(ahSubmissions)
    .innerJoin(ahStages, eq(ahSubmissions.stageId, ahStages.id))
    .where(and(eq(ahSubmissions.teamId, p.teamId), eq(ahSubmissions.stageId, p.stageId)))
    .orderBy(desc(ahSubmissions.createdAt))
    .limit(Math.min(p.limit ?? 50, 50));
  return rows.map((row) => ({ ...toSubmissionView(row.submission, row.stageNumber), code: row.submission.code }));
}
