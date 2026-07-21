import { NextResponse } from "next/server";
import { todayLeaderboard, aggregateLeaderboard } from "@/server/leaderboard";

export const dynamic = "force-dynamic";

/** GET /api/leaderboard?scope=today|month|all */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "today";
  const rows =
    scope === "month"
      ? await aggregateLeaderboard("month")
      : scope === "all"
        ? await aggregateLeaderboard("all")
        : await todayLeaderboard();
  return NextResponse.json({ scope, rows });
}
