import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ChallengeRowSchema } from "@/lib/algohunt/question-schema";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { fail, ok, parseLargeBody } from "@/server/algohunt/http";
import { upsertChallengeRow, validateQuestion } from "@/server/algohunt/import/challenges";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const DRY_RUN_MAX_BYTES = 16 * 1024 * 1024;
const COMMIT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/admin/algohunt/import/challenge?event=<slug>&dryRun=1
 *   dry run: the full question JSON (≤ 16 MB) → validation report; nothing is stored.
 *   commit:  the same JSON without `tests`, plus `sourceSha256` (≤ 2 MB) → { challengeId, replaced }.
 *            The tests follow through /challenges/[challengeId]/tests.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const url = new URL(req.url);
    const event = await resolveAdminEvent(url.searchParams.get("event"));
    if (!event) return fail("NOT_FOUND", "Event not found.");

    if (url.searchParams.get("dryRun") === "1") {
      const parsed = await parseLargeBody(req, z.unknown(), DRY_RUN_MAX_BYTES);
      if (!parsed.ok) return parsed.response;
      const report = validateQuestion(parsed.data);
      return ok({
        dryRun: true,
        report: {
          ok: report.ok,
          errors: report.errors.map(String),
          warnings: report.warnings.map(String),
          stats: report.stats,
        },
        sha256: crypto.createHash("sha256").update(parsed.text).digest("hex"),
      });
    }

    const parsed = await parseLargeBody(req, ChallengeRowSchema, COMMIT_MAX_BYTES);
    if (!parsed.ok) return parsed.response;
    const result = await upsertChallengeRow({ event, row: parsed.data, adminId: admin.id });
    if (!result.ok) return fail(result.code, result.message);
    return ok({ challengeId: result.challengeId, replaced: result.replaced });
  } catch (error) {
    console.error("[algohunt:import-challenge]", error);
    return fail("INTERNAL");
  }
}
