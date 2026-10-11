import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { getCodePoolStats, listBatches, listCodes } from "@/server/algohunt/codePool";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";
import type { CodeStatus } from "@/lib/algohunt/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/codes?event=&status=&batch=&q=&cursor=&limit= */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const url = new URL(req.url);
    const slug = url.searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const statusParam = url.searchParams.get("status")?.trim().toUpperCase();
    let status: CodeStatus | undefined;
    if (statusParam === "ACTIVE" || statusParam === "USED" || statusParam === "DISABLED") {
      status = statusParam;
    }

    const batch = url.searchParams.get("batch")?.trim() || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;

    const cursorParam = url.searchParams.get("cursor");
    const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const [stats, batches, codesResult] = await Promise.all([
      getCodePoolStats(event.id),
      listBatches(event.id),
      listCodes({
        eventId: event.id,
        status,
        batchId: batch,
        q,
        cursor: cursor !== undefined && !Number.isNaN(cursor) ? cursor : undefined,
        limit: limit !== undefined && !Number.isNaN(limit) ? limit : undefined,
      }),
    ]);

    return ok({
      stats,
      batches,
      codes: codesResult.codes,
      nextCursor: codesResult.nextCursor,
    });
  } catch (error) {
    console.error("[algohunt:admin:codes]", error);
    return fail("INTERNAL");
  }
}
