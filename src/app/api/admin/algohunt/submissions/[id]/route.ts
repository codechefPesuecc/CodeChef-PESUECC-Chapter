import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { getSubmissionDetail } from "@/server/algohunt/adminLogs";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/submissions/[id] */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const { id } = await params;
    if (!id) return fail("VALIDATION", "Submission ID is required.");

    const submission = await getSubmissionDetail(id);
    if (!submission) {
      return fail("NOT_FOUND", "Submission not found.");
    }

    return ok({ submission });
  } catch (error) {
    console.error("[algohunt:admin:submissions:detail]", error);
    return fail("INTERNAL");
  }
}
