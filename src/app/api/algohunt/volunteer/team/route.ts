import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { getVolunteerContext } from "@/server/algohunt/volunteers";
import { getTeamForCheckin } from "@/server/algohunt/checkin";
import { getCurrentUser } from "@/server/auth/session";
import { enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

/** GET /api/algohunt/volunteer/team?code= */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHENTICATED");

    const ctx = await getVolunteerContext();
    if (!ctx) {
      return fail("FORBIDDEN", "You're not assigned as an AlgoHunt volunteer.");
    }

    const limited = await enforceRateLimits([[`ah:vol:user:${ctx.user.id}`, 60, 60_000]]);
    if (limited) return limited;

    const url = new URL(req.url);
    const code = url.searchParams.get("code")?.trim();
    if (!code) {
      return fail("VALIDATION", "Team code is required.");
    }

    const data = await getTeamForCheckin(ctx.event.id, code);
    if (!data) {
      return fail("NOT_FOUND", "Team not found in this event.");
    }

    return ok({ team: data.team });
  } catch (error) {
    console.error("[algohunt:volunteer:team]", error);
    return fail("INTERNAL");
  }
}
