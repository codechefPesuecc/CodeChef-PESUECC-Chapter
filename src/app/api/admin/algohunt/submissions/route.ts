import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { listSubmissions } from "@/server/algohunt/adminLogs";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";
import type { AhVerdict } from "@/lib/algohunt/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/submissions?event=&team=&stage=&verdict=&cursor=&limit= */
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
    const stageParam = url.searchParams.get("stage");
    const stage = stageParam ? parseInt(stageParam, 10) : undefined;
    const verdict = (url.searchParams.get("verdict")?.trim() as AhVerdict) || undefined;
    const cursorParam = url.searchParams.get("cursor");
    const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const res = await listSubmissions({
      eventId: event.id,
      teamCode: team,
      stageNumber: stage && !Number.isNaN(stage) ? stage : undefined,
      verdict,
      cursor: cursor && !Number.isNaN(cursor) ? cursor : undefined,
      limit: limit && !Number.isNaN(limit) ? limit : undefined,
    });

    return ok({ rows: res.rows, nextCursor: res.nextCursor });
  } catch (error) {
    console.error("[algohunt:admin:submissions:list]", error);
    return fail("INTERNAL");
  }
}
