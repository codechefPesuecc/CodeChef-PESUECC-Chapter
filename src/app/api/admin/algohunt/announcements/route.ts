import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import {
  ANNOUNCEMENT_MAX_CHARS, cleanAnnouncementMessage, createAnnouncement, listAllAnnouncements,
} from "@/server/algohunt/announcements";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().max(4 * ANNOUNCEMENT_MAX_CHARS)
    .transform(cleanAnnouncementMessage)
    .pipe(z.string().min(1, "Write a message.").max(ANNOUNCEMENT_MAX_CHARS, "Keep it to 500 characters.")),
  priority: z.enum(["INFO", "WARNING", "CRITICAL"]),
}).strict();

/** Routes must name the event explicitly; only the admin page falls back to a default event. */
function eventSlug(req: Request): string | null {
  return new URL(req.url).searchParams.get("event")?.trim() || null;
}

const MISSING_EVENT = "Add ?event=<slug> to choose the event.";

/** GET /api/admin/algohunt/announcements?event=<slug>: every announcement, newest first. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    if (!(await getAdminUser())) return fail("FORBIDDEN");
    const slug = eventSlug(req);
    if (!slug) return fail("VALIDATION", MISSING_EVENT);
    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");
    return ok({ announcements: await listAllAnnouncements(event.id) });
  } catch (error) {
    console.error("[algohunt:announcements]", error);
    return fail("INTERNAL");
  }
}

/** POST /api/admin/algohunt/announcements?event=<slug>: { message, priority }. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");
    const slug = eventSlug(req);
    if (!slug) return fail("VALIDATION", MISSING_EVENT);
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");
    const announcement = await createAnnouncement({
      eventId: event.id, message: parsed.data.message, priority: parsed.data.priority, adminId: admin.id,
    });
    return ok({ announcement });
  } catch (error) {
    console.error("[algohunt:announcements]", error);
    return fail("INTERNAL");
  }
}
