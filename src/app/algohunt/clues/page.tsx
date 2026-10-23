import type { Metadata } from "next";
import ClueBook from "@/components/algohunt/clues/ClueBook";

export const metadata: Metadata = { title: "AlgoHunt 2.0 | Clue book" };

/**
 * Public clue book for teammates' phones. Outside the (team) group on purpose: no team login, since a
 * second login would sign the team laptop out. ?event=<slug> picks the event; without it, the running hunt.
 */
export default async function AlgoHuntCluesPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const { event } = await searchParams;
  const slug = typeof event === "string" && event.trim() ? event.trim() : null;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <ClueBook eventSlug={slug} />
    </main>
  );
}
