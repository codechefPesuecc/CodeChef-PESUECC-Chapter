import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { getIntegrityOverview } from "@/server/algohunt/admin/integrity";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/integrity?event=<slug>: devices, away time and alerts for every team. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");
    const slug = new URL(req.url).searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");
    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");
    return ok(await getIntegrityOverview(event), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:admin-integrity]", error);
    return fail("INTERNAL");
  }
}
