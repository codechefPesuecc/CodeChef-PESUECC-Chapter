/**
 * POST /api/algohunt/submissions — submit code for the current question
 * GET  /api/algohunt/submissions — list own submissions for the current question
 */
import { z } from "zod";
import { requireTeam } from "@/server/algohunt/teamSession";
import { getTeamProgress } from "@/server/algohunt/access";
import { createAndJudgeSubmission, listTeamSubmissions } from "@/server/algohunt/submissions";
import { ok, fail, parseBody } from "@/server/algohunt/http";
import { enforceRateLimits, clientIp } from "@/server/rateLimit";
import { MAX_CODE_CHARS } from "@/server/limits";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const submitSchema = z
  .object({
    language: z.string().max(20),
    code: z.string().min(1).max(MAX_CODE_CHARS),
    clientRequestId: z.string().uuid(),
  })
  .strict();

export async function POST(req: Request): Promise<NextResponse> {
  const ctx = await requireTeam();
  if (!("team" in ctx)) return ctx as NextResponse;

  const { team } = ctx;
  const ip = clientIp(req);

  // Rate limits (contract §15)
  const rateLimited = await enforceRateLimits([
    [`ah:submit:team:${team.id}`, 10, 60_000],
    [`ah:submit:ip:${ip}`, 60, 60_000],
  ]);
  if (rateLimited) return rateLimited;

  // Parse body
  const parsed = await parseBody(req, submitSchema);
  if (!parsed.ok) return parsed.response;
  const { language, code, clientRequestId } = parsed.data;

  const result = await createAndJudgeSubmission({
    ctx,
    language,
    code,
    clientRequestId,
    ip,
  });

  if (!result.ok) {
    return fail(result.code, result.message);
  }

  return ok(result.result);
}

export async function GET(_req: Request): Promise<NextResponse> {
  void _req;
  const ctx = await requireTeam();
  if (!("team" in ctx)) return ctx as NextResponse;

  const { team } = ctx;

  // Get current question only
  const progress = await getTeamProgress(ctx);
  const cur = progress.current;

  if (!cur) {
    return ok({ submissions: [] });
  }

  const submissions = await listTeamSubmissions({
    teamId: team.id,
    stageId: cur.stage.id,
  });

  return ok({ submissions });
}
