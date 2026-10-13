import { NextResponse } from "next/server";
import { z } from "zod";
import { CONFIRM_MISMATCH, confirmSchema, reasonSchema } from "@/server/algohunt/admin/schemas";
import { getTeamBrief } from "@/server/algohunt/admin/teams";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { reinstateTeam } from "@/server/algohunt/progression";
import { getAdminUser } from "@/server/auth/session";
import { clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: reasonSchema, confirm: confirmSchema }).strict();

/** POST /api/admin/algohunt/teams/[teamId]/reinstate: { reason, confirm: "<team code>" }. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { teamId } = await params;
    const team = await getTeamBrief(teamId);
    if (!team) return fail("NOT_FOUND", "Team not found.");
    if (parsed.data.confirm !== team.teamCode) return fail("VALIDATION", CONFIRM_MISMATCH);

    const { changed } = await reinstateTeam({
      eventId: team.eventId, teamId: team.id, adminId: admin.id, reason: parsed.data.reason, ip: clientIp(req),
    });
    return ok({ changed, message: changed ? "Team reinstated." : "Nothing changed: the team was not disqualified." });
  } catch (error) {
    console.error("[algohunt:admin-reinstate]", error);
    return fail("INTERNAL");
  }
}
