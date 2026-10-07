import type { Metadata } from "next";
import LeaderboardBoard from "@/components/algohunt/participant/LeaderboardBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AlgoHunt 2.0 | Leaderboard" };

export default function AlgoHuntLeaderboardPage() {
  return <LeaderboardBoard />;
}
