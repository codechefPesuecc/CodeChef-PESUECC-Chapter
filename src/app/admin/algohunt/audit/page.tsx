import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuditAdmin from "@/components/admin/algohunt/audit/AuditAdmin";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Audit Log · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

export default async function AlgoHuntAuditAdminPage({
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
          Audit Log
        </h1>
        {event ? (
          <>
            <p className="mt-1 text-sm text-charcoal/60">
              Event: {event.name} <span className="font-mono">({event.slug})</span>. Comprehensive audit trail of all operations and game transitions.
            </p>
            <div className="mt-6">
              <AuditAdmin eventSlug={event.slug} />
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-charcoal/70">No AlgoHunt event found. Create an event first.</p>
        )}
      </section>
    </main>
  );
}
