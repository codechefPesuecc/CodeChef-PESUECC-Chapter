import { NextResponse } from "next/server";
import { z } from "zod";
import { clueBookPath, MAX_CLUES } from "@/lib/algohunt/clues";
import {
  getAdminClueBook,
  parseClueLines,
  previewClueBook,
  replaceClues,
  validateClues,
} from "@/server/algohunt/clues";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const saveSchema = z
  .object({
    text: z.string().max(220_000, "The clue list is too long."),
    confirm: z.string().optional(),
  })
  .strict();

/** GET /api/admin/algohunt/clues?event=<slug>: the saved clue book with the codes behind each clue. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const slug = new URL(req.url).searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");
    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    return ok({ book: await getAdminClueBook(event.id), publicPath: clueBookPath(event.slug) }, NO_STORE);
  } catch (error) {
    console.error("[algohunt:admin:clues]", error);
    return fail("INTERNAL");
  }
}

/**
 * POST /api/admin/algohunt/clues?event=<slug>[&dryRun=1]: { text, confirm }. One clue per line.
 * Dry run → { problems, preview } (what each clue would link to). Saving replaces the whole clue
 * book, needs the typed event slug, and writes nothing unless every line passes.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const url = new URL(req.url);
    const slug = url.searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const parsed = await parseBody(req, saveSchema);
    if (!parsed.ok) return parsed.response;

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const dryRun = url.searchParams.get("dryRun") === "1";
    if (!dryRun && parsed.data.confirm !== event.slug) {
      return fail("VALIDATION", "Confirmation mismatch. Type the event slug to confirm.");
    }

    const entries = parseClueLines(parsed.data.text);
    if (entries.length < 1) return fail("VALIDATION", "Paste at least one clue.");
    if (entries.length > MAX_CLUES) return fail("VALIDATION", `Save at most ${MAX_CLUES} clues.`);

    if (dryRun) {
      return ok(
        { dryRun, count: entries.length, problems: validateClues(entries), preview: await previewClueBook(event.id, entries) },
        NO_STORE,
      );
    }

    const result = await replaceClues({ eventId: event.id, entries, adminId: admin.id });
    if (!result.ok) {
      return fail(result.code, result.message, result.problems ? { problems: result.problems } : undefined);
    }
    return ok(
      { dryRun, count: result.count, problems: [], book: await getAdminClueBook(event.id), publicPath: clueBookPath(event.slug) },
      NO_STORE,
    );
  } catch (error) {
    console.error("[algohunt:admin:clues]", error);
    return fail("INTERNAL");
  }
}
