import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AnnouncementsAdmin from "@/components/admin/algohunt/announcements/AnnouncementsAdmin";
import { getAnnouncementAuthors, listAllAnnouncements } from "@/server/algohunt/announcements";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "AlgoHunt announcements" };

// Reads the session + DB and gates on admin: never prerender or cache.
export const dynamic = "force-dynamic";

export default async function AlgoHuntAnnouncementsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const { event: slugParam } = await searchParams;
  const event = await resolveAdminEvent(typeof slugParam === "string" ? slugParam : null);

  const announcements = event ? await listAllAnnouncements(event.id) : [];
  const authors = await getAnnouncementAuthors(announcements.map((a) => a.createdBy));

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console · AlgoHunt 2.0</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">Announcements</h1>
        {event ? (
          <>
            <p className="mt-1 text-sm text-charcoal/60">
              Event: {event.name} <span className="font-mono">({event.slug})</span>. Teams see the 5 newest active
              announcements; WARNING and CRITICAL also show as a banner.
            </p>
            <div className="mt-6">
              <AnnouncementsAdmin eventSlug={event.slug} announcements={announcements} authors={authors} />
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-charcoal/70">No AlgoHunt event found. Create an event first.</p>
        )}
      </section>
    </main>
  );
}
