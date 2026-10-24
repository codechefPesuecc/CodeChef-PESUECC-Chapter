import { NextResponse } from "next/server";
import { z } from "zod";
import { CONFIRM_MISMATCH, confirmSchema } from "@/server/algohunt/admin/schemas";
import { checkInAllTeams } from "@/server/algohunt/checkin";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ confirm: confirmSchema }).strict();

/** POST /api/admin/algohunt/teams/checkin-all?event=<slug>: { confirm: "<event slug>" } → { count }. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const event = await resolveAdminEvent(new URL(req.url).searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");
    if (parsed.data.confirm !== event.slug) return fail("VALIDATION", CONFIRM_MISMATCH);
    // Same rule as checking in a single team: nothing changes once the event is over.
    if (event.status === "ENDED" || event.status === "ARCHIVED") return fail("EVENT_ENDED");

    return ok(await checkInAllTeams({ eventId: event.id, actorId: admin.id }));
  } catch (error) {
    console.error("[algohunt:admin-checkin-all]", error);
    return fail("INTERNAL");
  }
}
