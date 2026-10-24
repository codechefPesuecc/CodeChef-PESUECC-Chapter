import type { Metadata } from "next";
import ProgressList from "@/components/algohunt/participant/ProgressList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AlgoHunt 2.0 | Progress" };

export default function AlgoHuntProgressPage() {
  return <ProgressList />;
}
