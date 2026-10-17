import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ImportAdmin from "@/components/admin/algohunt/import/ImportAdmin";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getContentReport } from "@/server/algohunt/import/content";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Import · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

export default async function AlgoHuntImportAdminPage({
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
          Import
        </h1>
        {event ? (
          <>
            <p className="mt-1 text-sm text-charcoal/60">
              Event: {event.name} <span className="font-mono">({event.slug})</span>. Questions, their order, and the team
              roster. Question files stay on this laptop until imported; test data and solutions are never shown here.
            </p>
            <div className="mt-6">
              <ImportAdmin
                event={{ slug: event.slug, status: event.status, maxTeamSize: event.maxTeamSize }}
                initialReport={await getContentReport(event)}
              />
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-charcoal/70">No AlgoHunt event found. Create an event first.</p>
        )}
      </section>
    </main>
  );
}
