import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import TeamDetailView from "@/components/admin/algohunt/teams/TeamDetailView";
import { getTeamDetail, getTeamTimeline } from "@/server/algohunt/admin/teams";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "AlgoHunt team" };

// Reads the session + DB and gates on admin: never prerender or cache.
export const dynamic = "force-dynamic";

async function loadTeam(teamId: string) {
  const [detail, timeline] = await Promise.all([getTeamDetail(teamId), getTeamTimeline(teamId)]);
  return { detail, timeline, serverNow: Date.now() };
}

export default async function AlgoHuntTeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const { teamId } = await params;
  const { detail, timeline, serverNow } = await loadTeam(teamId);
  if (!detail) notFound();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console · AlgoHunt 2.0</p>
        <h1 className="mt-1 mb-6 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">Team detail</h1>
        <TeamDetailView detail={detail} timeline={timeline} serverNow={serverNow} />
      </section>
    </main>
  );
}
