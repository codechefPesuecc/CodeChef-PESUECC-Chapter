import type { Metadata } from "next";
import { redirect } from "next/navigation";
import IntegrityAdmin from "@/components/admin/algohunt/integrity/IntegrityAdmin";
import { getIntegrityOverview } from "@/server/algohunt/admin/integrity";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Integrity · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

export default async function AlgoHuntIntegrityAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const { event: slugParam } = await searchParams;
  const event = await resolveAdminEvent(typeof slugParam === "string" ? slugParam : null);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
          Admin console · AlgoHunt 2.0
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Integrity
        </h1>
        {event ? (
          <>
            <p className="mt-1 text-sm text-charcoal/60">
              Event: {event.name} <span className="font-mono">({event.slug})</span>. Devices each team logged in from,
              and how long their laptops spent away from AlgoHunt while playing.
            </p>
            <div className="mt-6">
              <IntegrityAdmin eventSlug={event.slug} initial={await getIntegrityOverview(event)} />
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-charcoal/70">No AlgoHunt event found. Create an event first.</p>
        )}
      </section>
    </main>
  );
}
