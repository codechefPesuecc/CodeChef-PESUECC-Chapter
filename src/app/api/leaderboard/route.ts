import { rateLimit, clientIp } from "@/server/rateLimit";
import { NextResponse } from "next/server";
import { todayLeaderboard, todayCommonLeaderboard, aggregateLeaderboard } from "@/server/leaderboard";
import { getDailyChallenges } from "@/lib/challenges";

const LEADERBOARD_LIMIT = 30;
const LEADERBOARD_WINDOW_MS = 60_000;
export const dynamic = "force-dynamic";

/** GET /api/leaderboard?scope=today|month|all&challenge=all|<slug> */
export async function GET(req: Request) {
  const limit = await rateLimit(`leaderboard:ip:${clientIp(req)}`, LEADERBOARD_LIMIT, LEADERBOARD_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded — try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "today";
  const challengeSlug = url.searchParams.get("challenge") ?? undefined;

  if (scope === "month") {
    const rows = await aggregateLeaderboard("month");
    return NextResponse.json({ scope, rows });
  }

  if (scope === "all") {
    const rows = await aggregateLeaderboard("all");
    return NextResponse.json({ scope, rows });
  }

  const dailies = await getDailyChallenges();

  // If challenge is explicitly "all", or if multiple POTDs exist and no slug is provided, default to common leaderboard
  if (challengeSlug === "all" || (!challengeSlug && dailies.length > 1)) {
    const rows = await todayCommonLeaderboard();
    return NextResponse.json({
      scope: "today",
      rows,
      challenge: "all",
      challenges: dailies.map((d) => ({
        slug: d.slug,
        title: d.title,
        difficulty: d.difficulty,
      })),
    });
  }

  const selectedSlug = challengeSlug ?? dailies[0]?.slug;
  const rows = await todayLeaderboard(selectedSlug);

  return NextResponse.json({
    scope: "today",
    rows,
    challenge: selectedSlug ?? null,
    challenges: dailies.map((d) => ({
      slug: d.slug,
      title: d.title,
      difficulty: d.difficulty,
    })),
  });
}