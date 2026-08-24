import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getChallengeBySlug,
  getDailyChallenge,
  toPublicContent,
} from "@/lib/challenges";
import { getCurrentUser } from "@/server/auth/session";
import { hasSolvedRanked } from "@/server/solves";
import { todayLeaderboard } from "@/server/leaderboard";
import { ordinal } from "@/lib/points";
import ProblemStatement from "@/components/cp-arena/ProblemStatement";
import ArenaWorkspace from "@/components/cp-arena/ArenaWorkspace";
import NextProblemCountdown from "@/components/cp-arena/NextProblemCountdown";

// The released set and today's daily are date-dependent — resolve per request.
export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);
  return {
    title: challenge ? `${challenge.title} · Arena` : "Arena",
    description: challenge
      ? `Solve "${challenge.title}" — the Problem of the Day in the CodeChef PESUECC Arena.`
      : "The daily competitive programming arena.",
  };
}

export default async function SolveProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);

  // Unknown or unreleased slugs don't resolve.
  if (!challenge) notFound();

  // If this isn't today's live problem, it should be solved as practice via
  // the archive route, not the ranked solve route.
  const daily = await getDailyChallenge();
  const isLive = daily?.slug === slug;

  // Today's ranked Problem of the Day is members-only — gate viewing behind
  // login. Past problems (isLive === false) stay open as practice.
  if (isLive) {
    const user = await getCurrentUser();
    if (!user) {
      return (
        <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
          <div className="max-w-md">
            <h1 className="font-display text-2xl font-bold text-chocolate">
              Log in to enter the Arena
            </h1>
            <p className="mt-3 text-charcoal/70">
              The Problem of the Day is for registered members. Log in or create
              an account to view today&apos;s problem and climb the leaderboard.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90"
              >
                Log in
              </Link>
              <Link href="/register" className="mecha-btn mecha-btn--ghost">
                Create account
              </Link>
            </div>
          </div>
        </main>
      );
    }

    // Hide-after-solve: once solved, today's problem isn't shown again until it
    // becomes a past problem (reviewable in the archive). Show the result instead.
    if (await hasSolvedRanked(user.id, slug)) {
      const board = await todayLeaderboard();
      const me = board.find((r) => r.display === (user.srn ?? user.prn));
      return (
        <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
          <div className="max-w-md">
            <div
              aria-hidden
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-600"
            >
              ✓
            </div>
            <h1 className="font-display text-2xl font-bold text-chocolate">
              You&apos;ve solved today&apos;s problem
            </h1>
            {me && !me.flagged && me.rank != null ? (
              <p className="mt-3 text-charcoal/70">
                You finished{" "}
                <span className="font-semibold text-brown">{ordinal(me.rank)}</span>{" "}
                — {me.points} pts
                {me.timeSeconds != null ? ` in ${formatClock(me.timeSeconds)}` : ""}.
              </p>
            ) : (
              <p className="mt-3 text-charcoal/70">Your solve is locked in.</p>
            )}
            <p className="mt-3 text-sm text-charcoal/60">
              It opens for review in the archive once the next problem drops —
              come back for the next challenge.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/leaderboard"
                className="rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90"
              >
                View leaderboard
              </Link>
              <Link href="/cp-arena" className="mecha-btn mecha-btn--ghost">
                Back to Arena
              </Link>
            </div>
          </div>
        </main>
      );
    }

    const cookieStore = await cookies();
    if (!cookieStore.get(`arena-consent-${slug}`)) {
      redirect(`/cp-arena/consent/${slug}`);
    }
  }


  const sample = challenge.samples[0];

  return (
    <main className="flex-1 flex flex-col h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        footer { display: none !important; }
      `}} />
      <section className="mx-auto w-full px-2 py-2 lg:px-4 lg:py-4 flex-1 flex flex-col min-h-0">
<div className="flex-1 min-h-0 relative">
          <ArenaWorkspace
            slug={challenge.slug}
            problem={<ProblemStatement challenge={toPublicContent(challenge)} />}
            sampleInput={sample?.input ?? ""}
            sampleOutput={sample?.output ?? ""}
            {...(!isLive && { practice: true })}
          />
        </div>
      </section>
    </main>
  );
}
