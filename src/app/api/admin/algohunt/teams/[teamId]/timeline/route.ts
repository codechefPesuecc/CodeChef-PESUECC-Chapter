import { NextResponse } from "next/server";
import { getTeamBrief, getTeamTimeline } from "@/server/algohunt/admin/teams";
import { fail, ok } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/teams/[teamId]/timeline: audit rows, submissions and code attempts, oldest first. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const { teamId } = await params;
    if (!(await getTeamBrief(teamId))) return fail("NOT_FOUND", "Team not found.");
    return ok({ timeline: await getTeamTimeline(teamId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:admin-team-timeline]", error);
    return fail("INTERNAL");
  }
}
