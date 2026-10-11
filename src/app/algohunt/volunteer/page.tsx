import type { Metadata } from "next";
import CheckinDesk from "@/components/algohunt/volunteer/CheckinDesk";

export const metadata: Metadata = {
  title: "Check-in Desk · AlgoHunt 2.0",
};

export const dynamic = "force-dynamic";

export default function VolunteerCheckinPage() {
  return <CheckinDesk />;
}
