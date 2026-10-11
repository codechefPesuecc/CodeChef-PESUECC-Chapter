/**
 * GET /api/algohunt/challenges/current
 * Returns the current question for the authenticated team.
 * Never returns any other question (no going back, no skipping ahead).
 */
import { requireTeam } from "@/server/algohunt/teamSession";
import { getTeamProgress } from "@/server/algohunt/access";
import { getStageChallenge, toChallengeView } from "@/server/algohunt/challenges";
import { ok, fail } from "@/server/algohunt/http";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request): Promise<NextResponse> {
  void _req;
  const ctx = await requireTeam();
  if (!("team" in ctx)) return ctx as NextResponse;

  const { event, team } = ctx;

  // Status checks per contract §12.1 (in order)
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return fail("EVENT_ENDED");
  }
  if (event.status === "DRAFT" || event.status === "CHECK_IN" || event.status === "READY") {
    return fail("EVENT_NOT_LIVE");
  }
  if (team.status === "DISQUALIFIED") {
    return fail("TEAM_DISQUALIFIED");
  }
  if (team.status === "REGISTERED") {
    return fail("TEAM_NOT_CHECKED_IN");
  }

  // Get the team's current question
  const progress = await getTeamProgress(ctx);
  const cur = progress.current;

  if (!cur) {
    // Team has finished (all questions completed) or no questions yet
    return ok({ challenge: null });
  }

  const sc = await getStageChallenge(cur.stage.id);
  if (!sc) {
    return fail("INTERNAL", "Challenge data not found.");
  }

  const challenge = toChallengeView(sc, {
    solved: cur.progress?.challengeSolved ?? false,
  });

  return ok({ challenge });
}
