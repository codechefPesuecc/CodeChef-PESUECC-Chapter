import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { assignVolunteer, listVolunteers } from "@/server/algohunt/volunteers";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const assignSchema = z
  .object({
    username: z.string().min(1, "Username is required.").max(64),
  })
  .strict();

/** GET /api/admin/algohunt/volunteers?event=<slug> */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const slug = new URL(req.url).searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const volunteers = await listVolunteers(event.id);
    return ok({ volunteers });
  } catch (error) {
    console.error("[algohunt:admin:volunteers:get]", error);
    return fail("INTERNAL");
  }
}

/** POST /api/admin/algohunt/volunteers?event=<slug> */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const slug = new URL(req.url).searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const parsed = await parseBody(req, assignSchema);
    if (!parsed.ok) return parsed.response;

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const res = await assignVolunteer({
      eventId: event.id,
      username: parsed.data.username,
      adminId: admin.id,
    });

    if (!res.ok) {
      return fail(res.code, res.message);
    }

    return ok({ id: res.id });
  } catch (error) {
    console.error("[algohunt:admin:volunteers:post]", error);
    return fail("INTERNAL");
  }
}
