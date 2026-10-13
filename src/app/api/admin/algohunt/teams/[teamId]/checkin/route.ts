import { NextResponse } from "next/server";
import { getTeamBrief } from "@/server/algohunt/admin/teams";
import { checkInTeam } from "@/server/algohunt/checkin";
import { checkOrigin, fail, ok } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/admin/algohunt/teams/[teamId]/checkin: no body. Checks in one registered team. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const originError = checkOrigin(req);
    if (originError) return originError;
    const { teamId } = await params;
    const team = await getTeamBrief(teamId);
    if (!team) return fail("NOT_FOUND", "Team not found.");

    const result = await checkInTeam({
      eventId: team.eventId, teamCode: team.teamCode, actorType: "ADMIN", actorId: admin.id,
    });
    if (!result.ok) return fail(result.code, result.message);
    return ok({ alreadyCheckedIn: result.alreadyCheckedIn, team: result.team });
  } catch (error) {
    console.error("[algohunt:admin-checkin]", error);
    return fail("INTERNAL");
  }
}
