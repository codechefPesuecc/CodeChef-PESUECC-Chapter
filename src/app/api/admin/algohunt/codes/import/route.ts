import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { importCodeBatch, MAX_CODES_PER_IMPORT } from "@/server/algohunt/codePool";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const importSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(60, "Name must be 60 characters or less."),
    codes: z
      .array(z.object({ code: z.string().max(64), note: z.string().max(500).optional() }).strict())
      .min(1, "Add at least one code.")
      .max(MAX_CODES_PER_IMPORT, `Import at most ${MAX_CODES_PER_IMPORT} codes at a time.`),
    confirm: z.string().optional(),
  })
  .strict();

/**
 * POST /api/admin/algohunt/codes/import?event=<slug>[&dryRun=1]: { name, codes: [{ code, note? }], confirm }.
 * Organizers' own codes (QR stickers printed before the event). Dry run → { problems } for every row;
 * the import itself needs the typed event slug and writes nothing unless every row passes.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const url = new URL(req.url);
    const slug = url.searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const parsed = await parseBody(req, importSchema);
    if (!parsed.ok) return parsed.response;

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const dryRun = url.searchParams.get("dryRun") === "1";
    if (!dryRun && parsed.data.confirm !== event.slug) {
      return fail("VALIDATION", "Confirmation mismatch. Type the event slug to confirm.");
    }

    const result = await importCodeBatch({
      eventId: event.id,
      name: parsed.data.name,
      entries: parsed.data.codes,
      adminId: admin.id,
      dryRun,
    });
    if (!result.ok) return fail(result.code, result.message);
    if (!dryRun && result.problems.length > 0) {
      return fail("VALIDATION", "Some codes can't be imported. Fix them and try again.", { problems: result.problems });
    }

    return ok(
      { dryRun, problems: result.problems, batch: result.batch, codes: result.codes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[algohunt:admin:codes:import]", error);
    return fail("INTERNAL");
  }
}
