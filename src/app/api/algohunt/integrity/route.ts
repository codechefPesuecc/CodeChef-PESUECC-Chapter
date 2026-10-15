import { NextResponse } from "next/server";
import { z } from "zod";
import { AWAY_REASONS } from "@/lib/algohunt/types";
import { enforceRateLimits } from "@/server/rateLimit";
import { resolveDeviceId, setDeviceCookie } from "@/server/algohunt/devices";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { endAwayEpisode, startAwayEpisode } from "@/server/algohunt/integrity";
import { requireTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("leave"), reasons: z.array(z.enum(AWAY_REASONS)).min(1).max(AWAY_REASONS.length) }).strict(),
  z.object({ action: z.literal("return"), id: z.string().uuid() }).strict(),
]);

/**
 * POST /api/algohunt/integrity
 *   { action: "leave", reasons }  → { recorded, id?, teamCount? }  (a laptop left the page)
 *   { action: "return", id }      → { closed, awayMs }             (it came back)
 * The server stamps both times, so how long a team was away never comes from the browser.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await requireTeam();
    if (ctx instanceof NextResponse) return ctx;
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const limited = await enforceRateLimits([[`ah:integrity:team:${ctx.team.id}`, 60, 60_000]]);
    if (limited) {
      const retryAfterSeconds = Number(limited.headers.get("Retry-After") ?? "1");
      return fail("RATE_LIMITED", undefined, { retryAfterSeconds });
    }

    const device = await resolveDeviceId();
    const response = parsed.data.action === "leave"
      ? ok(await startAwayEpisode({ ctx, deviceId: device.id, reasons: parsed.data.reasons }))
      : ok(await endAwayEpisode({ ctx, deviceId: device.id, id: parsed.data.id }));
    if (device.isNew) setDeviceCookie(response, device.id);
    return response;
  } catch (error) {
    console.error("[algohunt:integrity]", error);
    return fail("INTERNAL");
  }
}
