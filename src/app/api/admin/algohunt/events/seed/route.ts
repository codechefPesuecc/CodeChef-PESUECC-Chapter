import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/server/auth/session";
import { SeedRefusedError, seedTestEvent } from "@/server/algohunt/seed-test";
import { fail, ok, parseBody } from "@/server/algohunt/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/).optional(),
  name: z.string().min(1).max(100).optional(),
  reset: z.boolean().optional(),
  eventStatus: z.enum(["DRAFT", "CHECK_IN", "READY", "LIVE"]).optional(),
  // Type the slug to confirm: re-seeding wipes that test event.
  confirm: z.string().max(200),
}).strict();

const DEFAULT_SLUG = "test-event-2026";

/** POST /api/admin/algohunt/events/seed: create or wipe-and-reseed a TEST event (never a real one). */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const slug = parsed.data.slug ?? DEFAULT_SLUG;
    if (parsed.data.confirm !== slug) return fail("VALIDATION", "Confirmation text does not match.");

    const result = await seedTestEvent({
      slug,
      name: parsed.data.name,
      reset: parsed.data.reset ?? true,
      eventStatus: parsed.data.eventStatus ?? "READY",
    });
    return ok({
      event: result.event,
      stagesCount: result.stages.length,
      teamsCount: result.teams.length,
      codeBatchesCount: result.codeBatches.length,
      // Shown once on the Events page so testers can log in; only hashes are stored.
      teams: result.teams.map((team) => ({ teamName: team.teamName, teamCode: team.teamCode, password: team.plainPassword })),
      codes: result.codeBatches.flatMap((batch) => batch.codes),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SeedRefusedError) return fail("FORBIDDEN", error.message);
    console.error("[algohunt:seed]", error);
    return fail("INTERNAL");
  }
}
