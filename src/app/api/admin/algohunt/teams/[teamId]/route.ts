import { NextResponse } from "next/server";
import { getTeamDetail } from "@/server/algohunt/admin/teams";
import { fail, ok } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/teams/[teamId]: members, progress, codes by serial, submissions without source. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const { teamId } = await params;
    const detail = await getTeamDetail(teamId);
    if (!detail) return fail("NOT_FOUND", "Team not found.");
    return ok(detail, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:admin-team-detail]", error);
    return fail("INTERNAL");
  }
}
