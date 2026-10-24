import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventById, updateEventFlags } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const FLAG_KEYS = ["submissionsEnabled", "codesEnabled", "leaderboardVisible"] as const;

const bodySchema = z.object({
  submissionsEnabled: z.boolean().optional(),
  codesEnabled: z.boolean().optional(),
  leaderboardVisible: z.boolean().optional(),
  reason: z.string().trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(500, "Keep the reason to 500 characters."),
  confirm: z.string().max(200),
}).strict().refine(
  (b) => FLAG_KEYS.some((key) => b[key] !== undefined),
  { message: "Choose at least one setting to change." },
);

/** PATCH /api/admin/algohunt/events/[eventId]/flags: { <flags>?, reason, confirm: "<event slug>" }. */
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

    // Only real changes reach the engine, so a double click leaves one audit row, not two.
    const flags: Partial<Record<(typeof FLAG_KEYS)[number], boolean>> = {};
    for (const key of FLAG_KEYS) {
      const value = parsed.data[key];
      if (value !== undefined && value !== event[key]) flags[key] = value;
    }
    if (Object.keys(flags).length === 0) {
      return ok({ event, changed: false, message: "Nothing changed: those switches were already set that way." });
    }
    const updated = await updateEventFlags({ eventId: event.id, actorId: admin.id, reason: parsed.data.reason, flags });
    return ok({ event: updated, changed: true });
  } catch (error) {
    console.error("[algohunt:admin-flags]", error);
    return fail("INTERNAL");
  }
}
