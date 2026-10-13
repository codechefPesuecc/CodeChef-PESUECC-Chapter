import { NextRequest } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { importTeamsChunk, type ParsedTeamRow } from "@/server/algohunt/teams";
import { fail, ok } from "@/server/algohunt/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return fail("UNAUTHENTICATED", "Admin authentication required.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "Invalid JSON payload.");
  }

  const p = (body ?? {}) as {
    eventId?: string;
    teams?: ParsedTeamRow[];
    startingIndex?: number;
  };

  if (!p.eventId || typeof p.eventId !== "string") {
    return fail("VALIDATION", "eventId is required.");
  }
  if (!Array.isArray(p.teams) || p.teams.length === 0) {
    return fail("VALIDATION", "teams must be a non-empty array.");
  }

  const result = await importTeamsChunk({
    eventId: p.eventId,
    teams: p.teams,
    startingIndex: p.startingIndex,
    actorId: admin.id,
  });

  if (!result.ok) {
    const code = result.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION";
    return fail(code, result.message);
  }

  return ok({
    imported: result.imported,
    nextIndex: result.nextIndex,
  });
}
