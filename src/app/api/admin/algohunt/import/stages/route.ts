import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { getChallengeSlugs, replaceStageOrder, validateStageOrder } from "@/server/algohunt/import/stages";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  rows: z.array(z.object({
    stageNumber: z.number().int().min(1).max(100),
    challengeSlug: z.string().min(1).max(100),
    points: z.number().int().min(0).max(10_000).optional(),
  }).strict()).min(1).max(100),
  confirm: z.string().max(200).optional(),
}).strict();

/**
 * POST /api/admin/algohunt/import/stages?event=<slug>&dryRun=1: { rows: [{ stageNumber, challengeSlug, points? }] }.
 * Dry run → { errors, warnings }. Commit (with confirm: "<event slug>") replaces the question order.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const url = new URL(req.url);
    const event = await resolveAdminEvent(url.searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;

    if (url.searchParams.get("dryRun") === "1") {
      const slugs = await getChallengeSlugs(event.id);
      return ok({ dryRun: true, ...validateStageOrder(parsed.data.rows, { slugs: new Set(slugs.ids.keys()), unverified: slugs.unverified }) });
    }
    if (parsed.data.confirm !== event.slug) return fail("VALIDATION", "Confirmation text does not match.");
    const result = await replaceStageOrder({ event, rows: parsed.data.rows, adminId: admin.id });
    if (!result.ok) return fail(result.code, result.message);
    return ok({ stages: result.stages });
  } catch (error) {
    console.error("[algohunt:import-stages]", error);
    return fail("INTERNAL");
  }
}
