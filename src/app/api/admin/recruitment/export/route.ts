import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { exportApplicationsCsv } from "@/server/recruitment-applications";
import { getRecruitmentSettings } from "@/server/recruitment";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const url = new URL(req.url);
  const cycleParam = url.searchParams.get("cycle") || undefined;
  const settings = await getRecruitmentSettings();
  const cycle = cycleParam || settings.cycle?.trim() || "current";

  const csvContent = await exportApplicationsCsv(cycle);
  const filename = `recruitment-applications-${cycle.replace(/\s+/g, "_")}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
