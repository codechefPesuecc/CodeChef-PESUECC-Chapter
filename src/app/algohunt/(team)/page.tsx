import type { Metadata } from "next";
import Dashboard from "@/components/algohunt/participant/Dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AlgoHunt 2.0" };

export default function AlgoHuntDashboardPage() {
  return <Dashboard />;
}
