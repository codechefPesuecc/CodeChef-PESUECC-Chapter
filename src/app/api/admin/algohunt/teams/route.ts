import { NextResponse } from "next/server";
import { z } from "zod";
import { TEAM_STATUSES } from "@/lib/algohunt/types";
import { listTeams } from "@/server/algohunt/admin/teams";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(TEAM_STATUSES).optional(),
});

/** GET /api/admin/algohunt/teams?event=<slug>&q=&status=: the team list with progress summaries. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const params = new URL(req.url).searchParams;
    const query = querySchema.safeParse({
      q: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
    });
    if (!query.success) return fail("VALIDATION", "Invalid search or status filter.");
    const event = await resolveAdminEvent(params.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");
    const teams = await listTeams(event.id, query.data);
    return ok({ teams, serverNow: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:admin-teams]", error);
    return fail("INTERNAL");
  }
}
