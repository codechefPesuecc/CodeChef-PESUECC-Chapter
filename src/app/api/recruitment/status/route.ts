import { NextResponse } from "next/server";
import { getRecruitmentSettings } from "@/server/recruitment";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/recruitment/status — is the drive open? Public, and deliberately
 * returns nothing but a boolean: the form URL is admin-only information and the
 * navbar has no use for it.
 *
 * This exists because the navbar is a client component and can't read the
 * database. The alternative — reading the settings in the root layout — would
 * make every page in the app dynamic, since the layout wraps all of them, and
 * today most of them (/, /team, /login, /leaderboard …) are statically
 * prerendered. One small endpoint is a much cheaper price than losing that.
 *
 * Cached for 30s. Every visitor's navbar hits this on every page load, so an
 * uncached read would be a database query per page view; in exchange the link
 * can lag up to half a minute behind an admin toggling the drive, which for a
 * recruitment drive measured in weeks is not a real cost.
 */
export async function GET(req: Request) {
  const limited = await enforceRateLimits([
    [`recruitment-status:ip:${clientIp(req)}`, 120, 60_000],
  ]);
  if (limited) return limited;

  const settings = await getRecruitmentSettings();
  // canEmbed, not isOpen: this mirrors exactly what /join will render, so the
  // navbar can never advertise a form the page won't show.
  return NextResponse.json(
    { ok: true, isOpen: settings.canEmbed },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}
