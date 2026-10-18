import type { Metadata } from "next";
import CheckinDesk from "@/components/algohunt/volunteer/CheckinDesk";
import { getVolunteerContext } from "@/server/algohunt/volunteers";

export const metadata: Metadata = {
  title: "Check-in Desk · AlgoHunt 2.0",
};

export const dynamic = "force-dynamic";

/** The layout gates access; ?event=<slug> chooses the event when more than one is open. */
export default async function VolunteerCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const { event } = await searchParams;
  const ctx = await getVolunteerContext({ eventSlug: typeof event === "string" ? event : undefined });
  if (!ctx) {
    return <p className="text-sm text-charcoal/70">You&apos;re not assigned to that event. Ask the organizers for the right link.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-wider text-charcoal/60">
        Event: {ctx.event.name} <span className="text-bronze">({ctx.event.slug})</span>
      </p>
      <CheckinDesk eventSlug={ctx.event.slug} />
    </div>
  );
}
