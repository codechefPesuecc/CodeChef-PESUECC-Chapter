import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";
import { redeemCodeForTeam } from "@/server/algohunt/codePool";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { requireTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    code: z.string().max(64),
  })
  .strict();

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const auth = await requireTeam();
    if (auth instanceof NextResponse) {
      return auth;
    }

    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const ip = clientIp(req);
    const limited = await enforceRateLimits([
      [`ah:code:team:${auth.team.id}`, 8, 60_000],
      [`ah:code:ip:${ip}`, 30, 60_000],
    ]);
    if (limited) {
      const retryAfterSeconds = Number(limited.headers.get("Retry-After") ?? "1");
      const body = (await limited.json()) as { error?: string };
      return fail("RATE_LIMITED", body.error, { retryAfterSeconds });
    }

    const res = await redeemCodeForTeam({
      ctx: auth,
      rawCode: parsed.data.code,
      ip,
    });

    if (res.ok) {
      return ok(res.result);
    }

    return fail(
      res.code,
      res.message,
      res.retryAfterSeconds !== undefined ? { retryAfterSeconds: res.retryAfterSeconds } : undefined,
    );
  } catch (error) {
    console.error("[algohunt:redeem]", error);
    return fail("INTERNAL");
  }
}
