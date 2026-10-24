import { NextResponse } from "next/server";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok } from "@/server/algohunt/http";
import { getContentReport } from "@/server/algohunt/import/content";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/content?event=<slug>: is the event ready to start? */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const event = await resolveAdminEvent(new URL(req.url).searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");
    return ok({ report: await getContentReport(event) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:content]", error);
    return fail("INTERNAL");
  }
}
