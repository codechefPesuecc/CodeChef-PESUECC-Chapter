import { NextResponse } from "next/server";
import { enforceRateLimits } from "@/server/rateLimit";
import { fail, ok } from "@/server/algohunt/http";
import { buildParticipantState } from "@/server/algohunt/state";
import { requireTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await requireTeam();
    if (ctx instanceof NextResponse) return ctx;
    // Light limit to stop runaway loops; usePoll backs off on 429.
    const limited = await enforceRateLimits([[`ah:state:team:${ctx.team.id}`, 240, 60_000]]);
    if (limited) {
      const retryAfterSeconds = Number(limited.headers.get("Retry-After") ?? "1");
      return fail("RATE_LIMITED", undefined, { retryAfterSeconds });
    }
    return ok(await buildParticipantState(ctx), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:state]", error);
    return fail("INTERNAL");
  }
}
