import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { getVolunteerContext } from "@/server/algohunt/volunteers";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/algohunt/volunteer/me */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHENTICATED");

    const ctx = await getVolunteerContext();
    if (!ctx) {
      return fail("FORBIDDEN", "You're not assigned as an AlgoHunt volunteer.");
    }

    return ok({
      volunteer: {
        username: ctx.user.username,
        isAdmin: ctx.isAdmin,
      },
      event: {
        name: ctx.event.name,
        status: ctx.event.status,
        slug: ctx.event.slug,
      },
    });
  } catch (error) {
    console.error("[algohunt:volunteer:me]", error);
    return fail("INTERNAL");
  }
}
