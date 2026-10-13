import { NextResponse } from "next/server";
import { z } from "zod";
import { CONFIRM_MISMATCH, confirmSchema } from "@/server/algohunt/admin/schemas";
import { getTeamBrief, resetTeamPassword } from "@/server/algohunt/admin/teams";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";
import { clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ confirm: confirmSchema }).strict();

/** POST /api/admin/algohunt/teams/[teamId]/reset-password: { confirm: "<team code>" } → { password }, shown once. */
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

    const { password } = await resetTeamPassword({ teamId: team.id, adminId: admin.id, ip: clientIp(req) });
    // The plaintext password must never be cached by the browser or a proxy.
    return ok({ password }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:admin-reset-password]", error);
    return fail("INTERNAL");
  }
}
