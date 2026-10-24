import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { deactivateAnnouncement } from "@/server/algohunt/announcements";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ active: z.literal(false) }).strict();

/** PATCH /api/admin/algohunt/announcements/[id]: { active: false } deactivates (idempotent). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    return ok(await deactivateAnnouncement({ id, adminId: admin.id }));
  } catch (error) {
    console.error("[algohunt:announcements]", error);
    return fail("INTERNAL");
  }
}
