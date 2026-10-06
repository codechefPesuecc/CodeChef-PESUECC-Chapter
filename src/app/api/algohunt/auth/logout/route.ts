import { NextResponse } from "next/server";
import { clientIp } from "@/server/rateLimit";
import { writeAudit } from "@/server/algohunt/audit";
import { checkOrigin, fail, ok } from "@/server/algohunt/http";
import { AH_TEAM_COOKIE, getCurrentTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const originError = checkOrigin(req);
  if (originError) return originError;
  try {
    const ctx = await getCurrentTeam();
    const response = ok({});
    response.cookies.delete(AH_TEAM_COOKIE);
    if (ctx) {
      await writeAudit({
        eventId: ctx.event.id,
        teamId: ctx.team.id,
        actorType: "TEAM",
        actorId: null,
        action: "team.logout",
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
    }
    return response;
  } catch (error) {
    console.error("[algohunt:logout]", error);
    return fail("INTERNAL");
  }
}
