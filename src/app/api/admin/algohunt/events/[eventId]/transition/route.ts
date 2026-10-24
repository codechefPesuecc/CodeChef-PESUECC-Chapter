import { NextResponse } from "next/server";
import { z } from "zod";
import { EVENT_STATUSES } from "@/lib/algohunt/types";
import { getEventById, transitionEvent } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";
import { clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  to: z.enum(EVENT_STATUSES),
  confirm: z.string().max(200),
}).strict();

/** POST /api/admin/algohunt/events/[eventId]/transition: { to, confirm: "<event slug>" }. */
export async function POST(
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
    const result = await transitionEvent({
      eventId: event.id,
      to: parsed.data.to,
      actorId: admin.id,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    if (!result.ok) return fail(result.code, result.message);
    return ok({ event: result.event });
  } catch (error) {
    console.error("[algohunt:admin-transition]", error);
    return fail("INTERNAL");
  }
}
