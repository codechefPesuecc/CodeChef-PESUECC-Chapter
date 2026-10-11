import { NextResponse } from "next/server";
import { fail, ok } from "@/server/algohunt/http";
import { listCodeAttempts } from "@/server/algohunt/codePool";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";
import type { CodeAttemptResult } from "@/lib/algohunt/types";

export const dynamic = "force-dynamic";

const VALID_RESULTS = new Set<CodeAttemptResult>([
  "UNLOCKED",
  "ALREADY_UNLOCKED",
  "ALREADY_USED",
  "INVALID",
  "NOT_SOLVED",
  "COOLDOWN",
]);

/** GET /api/admin/algohunt/code-attempts?event=&team=&result=&suspicious=1&limit= */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN");

    const url = new URL(req.url);
    const slug = url.searchParams.get("event")?.trim();
    if (!slug) return fail("VALIDATION", "Add ?event=<slug> to choose the event.");

    const event = await resolveAdminEvent(slug);
    if (!event) return fail("NOT_FOUND", "No AlgoHunt event found.");

    const team = url.searchParams.get("team")?.trim() || undefined;

    const resultParam = url.searchParams.get("result")?.trim().toUpperCase();
    let result: CodeAttemptResult | undefined;
    if (resultParam && VALID_RESULTS.has(resultParam as CodeAttemptResult)) {
      result = resultParam as CodeAttemptResult;
    }

    const suspiciousParam = url.searchParams.get("suspicious");
    const suspicious = suspiciousParam === "1" || suspiciousParam === "true";

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const { attempts } = await listCodeAttempts({
      eventId: event.id,
      teamCode: team,
      result,
      suspicious,
      limit: limit && !Number.isNaN(limit) ? limit : undefined,
    });

    return ok({ attempts });
  } catch (error) {
    console.error("[algohunt:admin:code-attempts]", error);
    return fail("INTERNAL");
  }
}
