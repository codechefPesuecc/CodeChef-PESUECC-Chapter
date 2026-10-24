import { NextResponse } from "next/server";
import { z } from "zod";
import { AWAY_REASONS, INSTANT_FLAGS } from "@/lib/algohunt/types";
import { enforceRateLimits } from "@/server/rateLimit";
import { resolveDeviceId, setDeviceCookie } from "@/server/algohunt/devices";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { endAwayEpisode, recordInstantFlag, startAwayEpisode } from "@/server/algohunt/integrity";
import { requireTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("leave"), reasons: z.array(z.enum(AWAY_REASONS)).min(1).max(AWAY_REASONS.length) }).strict(),
  z.object({ action: z.literal("return"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("flag"), reason: z.enum(INSTANT_FLAGS) }).strict(),
]);

/**
 * POST /api/algohunt/integrity
 *   { action: "leave", reasons }  → { recorded, id?, teamCount? }  (a laptop left the page)
 *   { action: "return", id }      → { closed, awayMs }             (it came back)
 *   { action: "flag", reason }    → { recorded, teamCount? }       (a blocked right-click, copy, paste, key…)
 * The server stamps both times, so how long a team was away never comes from the browser.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await requireTeam();
    if (ctx instanceof NextResponse) return ctx;
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    // Instant flags get their own budget, so a burst of them can't crowd out away/return reports.
    const limited = await enforceRateLimits([parsed.data.action === "flag"
      ? [`ah:integrity:flag:team:${ctx.team.id}`, 30, 60_000]
      : [`ah:integrity:team:${ctx.team.id}`, 60, 60_000]]);
    if (limited) {
      const retryAfterSeconds = Number(limited.headers.get("Retry-After") ?? "1");
      return fail("RATE_LIMITED", undefined, { retryAfterSeconds });
    }

    const device = await resolveDeviceId();
    const data = parsed.data;
    const response = data.action === "leave"
      ? ok(await startAwayEpisode({ ctx, deviceId: device.id, reasons: data.reasons }))
      : data.action === "return"
        ? ok(await endAwayEpisode({ ctx, deviceId: device.id, id: data.id }))
        : ok(await recordInstantFlag({ ctx, deviceId: device.id, reason: data.reason }));
    if (device.isNew) setDeviceCookie(response, device.id);
    return response;
  } catch (error) {
    console.error("[algohunt:integrity]", error);
    return fail("INTERNAL");
  }
}
