import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getVolunteerContext } from "@/server/algohunt/volunteers";
import { checkInTeam } from "@/server/algohunt/checkin";
import { getCurrentUser } from "@/server/auth/session";
import { enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const checkinSchema = z
  .object({
    teamCode: z.string().min(1, "Team code is required.").max(32),
  })
  .strict();

/** POST /api/algohunt/volunteer/checkin */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHENTICATED");

    const ctx = await getVolunteerContext();
    if (!ctx) {
      return fail("FORBIDDEN", "You're not assigned as an AlgoHunt volunteer.");
    }

    const limited = await enforceRateLimits([[`ah:vol:user:${ctx.user.id}`, 60, 60_000]]);
    if (limited) return limited;

    const parsed = await parseBody(req, checkinSchema);
    if (!parsed.ok) return parsed.response;

    const result = await checkInTeam({
      eventId: ctx.event.id,
      teamCode: parsed.data.teamCode,
      actorType: ctx.isAdmin ? "ADMIN" : "VOLUNTEER",
      actorId: ctx.user.id,
    });

    if (!result.ok) {
      return fail(result.code, result.message);
    }

    return ok({
      alreadyCheckedIn: result.alreadyCheckedIn,
      team: result.team,
    });
  } catch (error) {
    console.error("[algohunt:volunteer:checkin]", error);
    return fail("INTERNAL");
  }
}
