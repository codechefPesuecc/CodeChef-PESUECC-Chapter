import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CONFIRM_MISMATCH, confirmSchema, reasonSchema } from "@/server/algohunt/admin/schemas";
import { getTeamBrief } from "@/server/algohunt/admin/teams";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { adminCompleteStage, adminRevertStage } from "@/server/algohunt/progression";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahStages } from "@/server/db/schema";
import { clientIp } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["COMPLETE_STAGE", "REVERT_STAGE"]),
  stageNumber: z.number().int().min(1),
  reason: reasonSchema,
  confirm: confirmSchema,
}).strict();

/** POST /api/admin/algohunt/teams/[teamId]/override: { action, stageNumber, reason, confirm: "<team code>" }. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { teamId } = await params;
    const team = await getTeamBrief(teamId);
    if (!team) return fail("NOT_FOUND", "Team not found.");
    if (parsed.data.confirm !== team.teamCode) return fail("VALIDATION", CONFIRM_MISMATCH);

    // The stage is looked up inside the team's own event, so a stage number can never reach another event.
    const [stage] = await getDb().select({ id: ahStages.id }).from(ahStages)
      .where(and(eq(ahStages.eventId, team.eventId), eq(ahStages.stageNumber, parsed.data.stageNumber)))
      .limit(1);
    if (!stage) return fail("NOT_FOUND", "Question not found.");

    const input = {
      eventId: team.eventId, teamId: team.id, stageId: stage.id,
      adminId: admin.id, reason: parsed.data.reason, ip: clientIp(req),
    };
    if (parsed.data.action === "COMPLETE_STAGE") {
      const result = await adminCompleteStage(input);
      if (!result.ok) return fail(result.code, result.message);
      return ok({
        changed: result.changed,
        finished: result.finished,
        message: result.changed ? "Question completed." : "Nothing changed: the question was already completed.",
      });
    }
    const result = await adminRevertStage(input);
    if (!result.ok) return fail(result.code, result.message);
    return ok({
      changed: result.changed,
      message: result.changed ? "Question reverted." : "Nothing changed: the question was not completed.",
    });
  } catch (error) {
    console.error("[algohunt:admin-override]", error);
    return fail("INTERNAL");
  }
}
