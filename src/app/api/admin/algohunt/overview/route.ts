import { NextResponse } from "next/server";
import { getOverview } from "@/server/algohunt/admin/overview";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/overview?event=<slug>: the command center snapshot. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const event = await resolveAdminEvent(new URL(req.url).searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");
    return ok(await getOverview(event), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:admin-overview]", error);
    return fail("INTERNAL");
  }
}
