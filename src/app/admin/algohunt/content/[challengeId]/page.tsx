import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "@/components/AppLink";
import ProblemStatement from "@/components/cp-arena/ProblemStatement";
import { toChallengeContent } from "@/server/algohunt/challenges";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahChallenges, ahEvents } from "@/server/db/schema";

export const metadata: Metadata = {
  title: "Question preview · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

/** Admins only: a question exactly as a team will see it (statement and samples; never the tests). */
export default async function AlgoHuntQuestionPreviewPage({ params }: { params: Promise<{ challengeId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  const { challengeId } = await params;
  const [row] = await getDb().select({ challenge: ahChallenges, slug: ahEvents.slug })
    .from(ahChallenges).innerJoin(ahEvents, eq(ahChallenges.eventId, ahEvents.id))
    .where(eq(ahChallenges.id, challengeId)).limit(1);
  if (!row) notFound();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <Link href={`/admin/algohunt/content?event=${encodeURIComponent(row.slug)}`} className="font-mono text-xs text-bronze hover:underline">
          ← Content readiness
        </Link>
        <p className="mt-2 rounded-md border border-yellow-500/50 bg-yellow-400/10 px-3 py-2 text-xs">
          Preview: this is what teams see on the question page. Hidden tests and solutions are not shown.
        </p>
        <div className="mt-6 rounded-2xl border border-hairline bg-panel p-6">
          <ProblemStatement challenge={toChallengeContent(row.challenge)} />
        </div>
      </section>
    </main>
  );
}
