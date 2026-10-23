import { NextResponse } from "next/server";
import { getPublicClueBook, resolveClueBookEvent } from "@/server/algohunt/clues";
import { fail, ok } from "@/server/algohunt/http";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

// Generous: phones on the campus Wi-Fi can all share one IP, and each polls every 10 s.
const PER_IP_PER_MINUTE = 1200;

/**
 * GET /api/algohunt/clues[?event=<slug>]: the public clue book. No team login, so teammates' phones
 * never sign the team laptop out. Without ?event= it shows the running hunt (else the newest real event).
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const limited = await enforceRateLimits([[`ah:clues:ip:${clientIp(req)}`, PER_IP_PER_MINUTE, 60_000]]);
    if (limited) {
      const retryAfterSeconds = Number(limited.headers.get("Retry-After") ?? "1");
      return fail("RATE_LIMITED", undefined, { retryAfterSeconds });
    }

    const slug = new URL(req.url).searchParams.get("event")?.trim().slice(0, 100) || null;
    const event = await resolveClueBookEvent(slug);
    const book = event ? await getPublicClueBook(event.id) : null;
    if (!book) return fail("NOT_FOUND", "No clue book found. Check the link.");

    return ok(book, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[algohunt:clues]", error);
    return fail("INTERNAL");
  }
}
