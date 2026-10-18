import { NextResponse } from "next/server";
import { writeAudit } from "@/server/algohunt/audit";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail } from "@/server/algohunt/http";
import { EXPORT_TYPES, buildExport, type ExportType } from "@/server/algohunt/import/exports";
import { getAdminUser } from "@/server/auth/session";
import { clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

/** GET /api/admin/algohunt/export?event=<slug>&type=results|submissions|codes|code_attempts|audit|teams → .xlsx */
export async function GET(req: Request): Promise<Response> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const url = new URL(req.url);
    const type = url.searchParams.get("type") as ExportType | null;
    if (!type || !EXPORT_TYPES.includes(type)) return fail("VALIDATION", `type must be one of ${EXPORT_TYPES.join(", ")}.`);
    const event = await resolveAdminEvent(url.searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");

    const { filename, buffer } = await buildExport(event, type);
    await writeAudit({
      eventId: event.id, actorType: "ADMIN", actorId: admin.id, action: "export.downloaded",
      targetType: "event", targetId: event.id, metadata: { type }, ip: clientIp(req),
    });
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[algohunt:export]", error);
    return fail("INTERNAL");
  }
}
