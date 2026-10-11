import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { getBatchForPrint } from "@/server/algohunt/codePool";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/codes/batches/[batchId]/print */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> }
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const { batchId } = await params;
    if (!batchId) return fail("VALIDATION", "Batch ID is required.");

    const data = await getBatchForPrint(batchId);
    if (!data) return fail("NOT_FOUND", "Batch not found.");

    return ok(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[algohunt:admin:codes:batch:print]", error);
    return fail("INTERNAL");
  }
}
