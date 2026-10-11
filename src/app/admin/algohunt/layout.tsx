import { Suspense } from "react";
import { desc } from "drizzle-orm";
import AlgoHuntAdminNav from "@/components/admin/algohunt/nav/AlgoHuntAdminNav";
import type { NavEvent } from "@/components/admin/algohunt/nav/navModel";
import type { EventStatus } from "@/lib/algohunt/types";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahEvents } from "@/server/db/schema";

// Reads the session + DB: never prerender or cache.
export const dynamic = "force-dynamic";

/**
 * Presentational shell for every /admin/algohunt/* page: the event switcher and the sub-nav.
 *
 * NOT the security boundary. Every page still gates itself with getAdminUser() + redirect("/"),
 * like src/app/admin/layout.tsx. The admin check below only decides whether to draw the nav, so
 * event names and slugs never reach a visitor who isn't an admin.
 */
export default async function AlgoHuntAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  let events: NavEvent[] = [];
  if (admin) {
    const rows = await getDb()
      .select({
        id: ahEvents.id, slug: ahEvents.slug, name: ahEvents.name,
        status: ahEvents.status, isTest: ahEvents.isTest,
      })
      .from(ahEvents)
      .orderBy(desc(ahEvents.createdAt));
    events = rows.map((row) => ({ ...row, status: row.status as EventStatus }));
  }
  return (
    <>
      {admin && (
        <div className="mx-auto max-w-4xl px-6">
          <Suspense fallback={<div className="mb-6 h-16 border-b border-hairline" aria-hidden="true" />}>
            <AlgoHuntAdminNav events={events} />
          </Suspense>
        </div>
      )}
      {children}
    </>
  );
}
