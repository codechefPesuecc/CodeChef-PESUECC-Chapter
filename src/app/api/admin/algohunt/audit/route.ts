import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { listAudit } from "@/server/algohunt/adminLogs";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/audit?event=&team=&action=&before=&limit= */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const url = new URL(req.url);
    const slug = url.searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const team = url.searchParams.get("team")?.trim() || undefined;
    const actionPrefix = url.searchParams.get("action")?.trim() || undefined;
    const beforeParam = url.searchParams.get("before");
    const before = beforeParam ? parseInt(beforeParam, 10) : undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const res = await listAudit({
      eventId: event.id,
      teamCode: team,
      actionPrefix,
      before: before && !Number.isNaN(before) ? before : undefined,
      limit: limit && !Number.isNaN(limit) ? limit : undefined,
    });

    return ok({ rows: res.rows, nextCursor: res.nextCursor });
  } catch (error) {
    console.error("[algohunt:admin:audit:list]", error);
    return fail("INTERNAL");
  }
}
