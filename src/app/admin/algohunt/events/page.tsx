import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EventsAdmin from "@/components/admin/algohunt/events/EventsAdmin";
import { listEvents, resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "AlgoHunt Events · Admin",
};

export const dynamic = "force-dynamic";

export default async function AlgoHuntEventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const { event: slugParam } = await searchParams;
  const currentEvent = await resolveAdminEvent(typeof slugParam === "string" ? slugParam : null);
  const events = await listEvents();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
          Admin console · AlgoHunt 2.0
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Events Management
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Create new live/test events, switch active event, and seed reproducible test arenas.
        </p>

        <div className="mt-6">
          <EventsAdmin initialEvents={events} currentSlug={currentEvent?.slug} />
        </div>
      </section>
    </main>
  );
}
