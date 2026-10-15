import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/server/rateLimit";
import { getEventById, setEventEndTime } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Epoch ms, or null to remove the scheduled end (the event then only stops when an admin ends it).
  endsAt: z.number().int().min(Date.UTC(2024, 0, 1)).max(Date.UTC(2100, 0, 1)).nullable(),
  reason: z.string().trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(500, "Keep the reason to 500 characters."),
  confirm: z.string().max(200),
}).strict();

/** PATCH /api/admin/algohunt/events/[eventId]/end-time: { endsAt, reason, confirm: "<event slug>" }. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { eventId } = await params;
    const event = await getEventById(eventId);
    if (!event) return fail("NOT_FOUND", "Event not found.");
    if (parsed.data.confirm !== event.slug) return fail("VALIDATION", "Confirmation text does not match.");

    const result = await setEventEndTime({
      eventId: event.id,
      actorId: admin.id,
      reason: parsed.data.reason,
      endsAt: parsed.data.endsAt,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    if (!result.ok) return fail(result.code, result.message);
    return ok({
      event: result.event,
      changed: result.changed,
      ...(result.changed ? {} : { message: "Nothing changed: the end time was already set to that." }),
    });
  } catch (error) {
    console.error("[algohunt:admin-end-time]", error);
    return fail("INTERNAL");
  }
}
