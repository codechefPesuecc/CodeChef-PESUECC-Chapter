import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import CommandCenter from "@/components/admin/algohunt/overview/CommandCenter";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "AlgoHunt command center" };

// Reads the session + DB and gates on admin: never prerender or cache.
export const dynamic = "force-dynamic";

export default async function AlgoHuntCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const { event: slugParam } = await searchParams;
  const slug = typeof slugParam === "string" ? slugParam : null;
  const event = await resolveAdminEvent(slug);

  let body: React.ReactNode;
  if (event) {
    body = <CommandCenter eventSlug={event.slug} />;
  } else if (slug) {
    body = (
      <p className="text-sm text-charcoal/70">
        There is no event called <span className="font-mono">{slug}</span>. Pick one from the event switcher above.
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-charcoal/70">
        No AlgoHunt event yet. Create one under{" "}
        <Link href="/admin/algohunt/events" className="text-bronze underline">Events</Link>.
      </p>
    );
  }

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console · AlgoHunt 2.0</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">Command center</h1>
        <div className="mt-6">{body}</div>
      </section>
    </main>
  );
}
