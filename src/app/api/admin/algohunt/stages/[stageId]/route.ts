import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getEventById } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahStages } from "@/server/db/schema";
import { clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(500, "Keep the reason to 500 characters."),
  confirm: z.string().max(200),
}).strict();

/** PATCH /api/admin/algohunt/stages/[stageId]: { enabled, reason, confirm: "<event slug>" }. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stageId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { stageId } = await params;
    const db = getDb();
    const [stage] = await db.select().from(ahStages).where(eq(ahStages.id, stageId)).limit(1);
    if (!stage) return fail("NOT_FOUND", "Question not found.");
    const event = await getEventById(stage.eventId);
    if (!event) return fail("NOT_FOUND", "Event not found.");
    if (parsed.data.confirm !== event.slug) return fail("VALIDATION", "Confirmation text does not match.");

    // One batch: flip the switch, and write the audit row only if this very update changed it, so a
    // repeated click (one request after another) leaves a single audit row.
    const { enabled, reason } = parsed.data;
    const now = Date.now();
    const metadata = JSON.stringify({ stageNumber: stage.stageNumber, enabled, reason });
    const [changedRows] = await db.batch([
      db.update(ahStages).set({ enabled, updatedAt: now })
        .where(and(eq(ahStages.id, stage.id), eq(ahStages.enabled, !enabled)))
        .returning({ id: ahStages.id }),
      db.insert(ahAuditLogs).select(sql`
        SELECT ${crypto.randomUUID()}, ${stage.eventId}, NULL, 'ADMIN', ${admin.id}, 'stage.toggled',
          'stage', ${stage.id}, ${metadata}, ${clientIp(req)}, ${req.headers.get("user-agent")?.slice(0, 300) ?? null}, ${now}
        WHERE EXISTS (
          SELECT 1 FROM ah_stages WHERE id = ${stage.id} AND enabled = ${enabled ? 1 : 0} AND updated_at = ${now}
        )
      `),
    ]);
    const changed = changedRows.length > 0;
    return ok({
      changed,
      stage: { id: stage.id, stageNumber: stage.stageNumber, enabled },
      ...(changed ? {} : { message: "Nothing changed: the question was already in that state." }),
    });
  } catch (error) {
    console.error("[algohunt:admin-stage]", error);
    return fail("INTERNAL");
  }
}
