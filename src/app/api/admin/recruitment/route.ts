import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { getRecruitmentSettings, updateRecruitmentSettings } from "@/server/recruitment";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/recruitment — update the recruitment drive settings
 * (admins only). Body is a partial: any of isOpen, formUrl, cycle, closesOn.
 * Gated here as well as on the page — a route handler is reachable by direct
 * POST no matter what the UI shows.
 *
 * Returns the settings as persisted (not an echo of the request body) so the
 * client syncs to server truth — its own guess at updatedAt/updatedBy, or a
 * server-side normalization of the URL, would otherwise silently diverge from
 * the row a second admin might see.
 */
export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  let body: {
    isOpen?: unknown;
    formUrl?: unknown;
    cycle?: unknown;
    closesOn?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const result = await updateRecruitmentSettings(admin.id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const settings = await getRecruitmentSettings();
  return NextResponse.json({ ok: true, settings });
}
