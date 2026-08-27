import { rateLimit, clientIp } from "@/server/rateLimit";
import { NextResponse } from "next/server";
import { todayLeaderboard, aggregateLeaderboard } from "@/server/leaderboard";

const LEADERBOARD_LIMIT = 30;
const LEADERBOARD_WINDOW_MS = 60_000;
export const dynamic = "force-dynamic";

/** GET /api/leaderboard?scope=today|month|all */
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
  const scope = new URL(req.url).searchParams.get("scope") ?? "today";
  const rows =
    scope === "month"
      ? await aggregateLeaderboard("month")
      : scope === "all"
        ? await aggregateLeaderboard("all")
        : await todayLeaderboard();
  return NextResponse.json({ scope, rows });
}