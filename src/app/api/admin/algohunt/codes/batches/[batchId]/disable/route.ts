import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { disableBatch } from "@/server/algohunt/codePool";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahCodeBatches, ahEvents } from "@/server/db/schema";

export const dynamic = "force-dynamic";

const disableSchema = z
  .object({
    reason: z
      .string()
      .min(5, "Reason must be at least 5 characters.")
      .max(500, "Reason must be 500 characters or less."),
    confirm: z.string().min(1, "Event confirmation is required."),
  })
  .strict();

/** POST /api/admin/algohunt/codes/batches/[batchId]/disable */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const { batchId } = await params;
    if (!batchId) return fail("VALIDATION", "Batch ID is required.");

    const parsed = await parseBody(req, disableSchema);
    if (!parsed.ok) return parsed.response;

    const db = getDb();
    const [batch] = await db
      .select({ id: ahCodeBatches.id, eventId: ahCodeBatches.eventId })
      .from(ahCodeBatches)
      .where(eq(ahCodeBatches.id, batchId))
      .limit(1);

    if (!batch) return fail("NOT_FOUND", "Batch not found.");

    const [event] = await db
      .select({ slug: ahEvents.slug })
      .from(ahEvents)
      .where(eq(ahEvents.id, batch.eventId))
      .limit(1);

    if (!event || parsed.data.confirm !== event.slug) {
      return fail("VALIDATION", "Confirmation mismatch. Type the event slug to confirm.");
    }

    const result = await disableBatch({
      batchId,
      reason: parsed.data.reason,
      adminId: admin.id,
    });

    return ok({ disabled: result.disabled });
  } catch (error) {
    console.error("[algohunt:admin:codes:batch:disable]", error);
    return fail("INTERNAL");
  }
}
