import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { createCodeBatch } from "@/server/algohunt/codePool";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const batchSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(60, "Name must be 60 characters or less."),
    size: z.number().int().min(1, "Size must be at least 1.").max(200, "Size must be 200 or less."),
    confirm: z.string().min(1, "Event confirmation is required."),
  })
  .strict();

/** POST /api/admin/algohunt/codes/batches?event=<slug> */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const url = new URL(req.url);
    const slug = url.searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const parsed = await parseBody(req, batchSchema);
    if (!parsed.ok) return parsed.response;

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    if (parsed.data.confirm !== event.slug) {
      return fail("VALIDATION", "Confirmation mismatch. Type the event slug to confirm.");
    }

    const result = await createCodeBatch({
      eventId: event.id,
      name: parsed.data.name,
      size: parsed.data.size,
      adminId: admin.id,
    });

    if (!result.ok) {
      return fail(result.code, result.message);
    }

    return ok({ batch: result.batch, codes: result.codes });
  } catch (error) {
    console.error("[algohunt:admin:codes:batches]", error);
    return fail("INTERNAL");
  }
}
