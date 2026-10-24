import { NextRequest } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { getEventById, getEventBySlug, resolveAdminEvent } from "@/server/algohunt/events";
import { getEventTeamsForCredentials } from "@/server/algohunt/teams";
import { fail, ok } from "@/server/algohunt/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return fail("UNAUTHENTICATED", "Admin authentication required.");

  const { searchParams } = new URL(req.url);
  const eventIdParam = searchParams.get("eventId");
  const eventSlugParam = searchParams.get("slug") || searchParams.get("event");

  let event = null;
  if (eventIdParam) {
    event = await getEventById(eventIdParam);
  } else if (eventSlugParam) {
    event = await getEventBySlug(eventSlugParam);
  } else {
    event = await resolveAdminEvent();
  }

  if (!event) {
    return fail("NOT_FOUND", "Event not found.");
  }

  const teams = await getEventTeamsForCredentials(event.id);
  return ok({
    event: { id: event.id, slug: event.slug, name: event.name },
    teams,
  });
}
