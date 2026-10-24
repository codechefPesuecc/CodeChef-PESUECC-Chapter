import { NextResponse } from "next/server";
import { fail, ok, checkOrigin } from "@/server/algohunt/http";
import { removeVolunteer } from "@/server/algohunt/volunteers";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** DELETE /api/admin/algohunt/volunteers/[id] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const originErr = checkOrigin(req);
    if (originErr) return originErr;

    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const { id } = await params;
    if (!id) return fail("VALIDATION", "Volunteer ID is required.");

    const res = await removeVolunteer({ id, adminId: admin.id });
    if (!res.ok) {
      return fail("NOT_FOUND", "Volunteer assignment not found.");
    }

    return ok({});
  } catch (error) {
    console.error("[algohunt:admin:volunteers:delete]", error);
    return fail("INTERNAL");
  }
}
