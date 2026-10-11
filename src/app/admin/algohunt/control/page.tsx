import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import ControlPanel from "@/components/admin/algohunt/control/ControlPanel";
import { deriveReadiness, type ControlStage } from "@/components/admin/algohunt/control/controlModel";
import type { EventStatus } from "@/lib/algohunt/types";
import { getCodePoolStats } from "@/server/algohunt/codePool";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahChallenges, ahStages, ahTeams } from "@/server/db/schema";

export const metadata: Metadata = { title: "AlgoHunt event control" };

// Reads the session + DB and gates on admin: never prerender or cache.
export const dynamic = "force-dynamic";

export default async function AlgoHuntControlPage({
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
    const db = getDb();
    const [stageRows, teamRows, pool] = await Promise.all([
      db.select({
        id: ahStages.id,
        stageNumber: ahStages.stageNumber,
        isFinal: ahStages.isFinal,
        enabled: ahStages.enabled,
        title: ahChallenges.title,
        verifiedAt: ahChallenges.verifiedAt,
      })
        .from(ahStages)
        .innerJoin(ahChallenges, eq(ahStages.challengeId, ahChallenges.id))
        .where(eq(ahStages.eventId, event.id))
        .orderBy(asc(ahStages.stageNumber)),
      db.select({ count: sql<number>`count(*)` })
        .from(ahTeams)
        .where(and(eq(ahTeams.eventId, event.id), inArray(ahTeams.status, ["CHECKED_IN", "FINISHED"]))),
      getCodePoolStats(event.id),
    ]);
    const stages: ControlStage[] = stageRows.map((row) => ({
      id: row.id,
      stageNumber: row.stageNumber,
      title: row.title,
      isFinal: row.isFinal,
      enabled: row.enabled,
      verified: row.verifiedAt !== null,
    }));
    body = (
      <ControlPanel
        event={{
          id: event.id, slug: event.slug, name: event.name, status: event.status as EventStatus,
          isTest: event.isTest, startedAt: event.startedAt, pausedAt: event.pausedAt, endedAt: event.endedAt,
          submissionsEnabled: event.submissionsEnabled, codesEnabled: event.codesEnabled,
          leaderboardVisible: event.leaderboardVisible,
        }}
        stages={stages}
        readiness={deriveReadiness(stages, pool.active, teamRows[0]?.count ?? 0)}
      />
    );
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
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console · AlgoHunt 2.0</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">Event control</h1>
        <div className="mt-6">{body}</div>
      </section>
    </main>
  );
}
