import { NextResponse } from "next/server";
import { getHealth } from "@/server/algohunt/admin/health";
import { fail, ok } from "@/server/algohunt/http";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/health: { judge, db } (contract §12.3). */
export async function GET(): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    return ok(await getHealth(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:health]", error);
    return fail("INTERNAL");
  }
}
