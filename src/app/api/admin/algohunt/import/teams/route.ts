import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { MAX_TEAMS_PER_IMPORT_CHUNK, getRosterContext, importTeamsChunk, validateRoster } from "@/server/algohunt/teams";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const member = z.object({
  name: z.string().max(120),
  email: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  isCaptain: z.boolean().optional(),
}).strict();

const bodySchema = z.object({
  teams: z.array(z.object({
    teamName: z.string().max(80),
    college: z.string().max(200).optional(),
    members: z.array(member).max(10),
  }).strict()).min(1).max(500),
  markCheckedIn: z.boolean().optional(),
}).strict();

/**
 * POST /api/admin/algohunt/import/teams?event=<slug>&dryRun=1: { teams, markCheckedIn? }.
 * Dry run → { errors, warnings } for the whole roster. Commit: ≤ 10 teams per call → the new
 * teams' codes and passwords, returned once (only the hash is stored).
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const url = new URL(req.url);
    const event = await resolveAdminEvent(url.searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;

    if (url.searchParams.get("dryRun") === "1") {
      const check = validateRoster(parsed.data.teams, { maxTeamSize: event.maxTeamSize, ...await getRosterContext(event.id) });
      return ok({ dryRun: true, teams: parsed.data.teams.length, ...check });
    }
    if (parsed.data.teams.length > MAX_TEAMS_PER_IMPORT_CHUNK) {
      return fail("VALIDATION", `Send at most ${MAX_TEAMS_PER_IMPORT_CHUNK} teams per call.`);
    }
    const result = await importTeamsChunk({
      eventId: event.id, teams: parsed.data.teams, actorId: admin.id, markCheckedIn: parsed.data.markCheckedIn,
    });
    if (!result.ok) return fail(result.code, result.message);
    return ok({
      created: result.imported.map((team) => ({ teamName: team.teamName, teamCode: team.teamCode, password: team.plainPassword })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:import-teams]", error);
    return fail("INTERNAL");
  }
}
