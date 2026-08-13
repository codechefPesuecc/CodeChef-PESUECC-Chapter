import type { Metadata } from "next";
import { events } from "@/lib/events";
import NewsroomHub from "./NewsroomHub";

export const metadata: Metadata = {
  title: "Newsroom",
  description:
    "Announcements, event recaps, contest results, and stories from the CodeChef PESUECC Chapter.",
};

export default function NewsroomPage() {
  return (
    <main className="flex-1">
      <NewsroomHub events={events} />
    </main>
  );
}
