import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getChallengeBySlug,
  getDailyChallenge,
} from "@/lib/challenges";
import { getCurrentUser } from "@/server/auth/session";
import ProblemStatement from "@/components/cp-arena/ProblemStatement";
import ArenaWorkspace from "@/components/cp-arena/ArenaWorkspace";
import ArenaRules from "@/components/cp-arena/ArenaRules";
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

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Hard: "bg-red-500/15 text-red-700 dark:text-red-400",
};

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
  }

  const difficultyStyle =
    DIFFICULTY_STYLES[challenge.difficulty] ?? "bg-bronze/15 text-bronze";
  const sample = challenge.samples[0];

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-7xl px-6 pt-6 pb-20">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
          <Link
            href="/cp-arena"
            className="text-charcoal/50 underline decoration-charcoal/20 underline-offset-2 transition-colors hover:text-bronze"
          >
            ← Arena
          </Link>
          <span className="text-charcoal/40">·</span>
          <span className="font-semibold uppercase tracking-wider text-bronze">
            {isLive ? "Problem of the Day" : "Practice"}
          </span>
          <span className="text-charcoal/40">·</span>
          <span className="text-charcoal/60">{formatDate(challenge.date)}</span>
          {isLive && (
            <>
              <span className="text-charcoal/40">·</span>
              <NextProblemCountdown />
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            {challenge.title}
          </h1>
          <span className={`mecha-chip ${difficultyStyle}`}>
            {challenge.difficulty}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {challenge.tags.map((tag) => (
            <span key={tag} className="mecha-chip bg-bronze/10 text-brown">
              {tag}
            </span>
          ))}
          {challenge.timeLimit && (
            <span className="ml-1 text-xs text-charcoal/50">
              {challenge.timeLimit} limit
            </span>
          )}
          {challenge.memoryLimit && (
            <span className="text-xs text-charcoal/50">
              · {challenge.memoryLimit}
            </span>
          )}
        </div>

        {challenge.author && (
          <p className="mt-3 text-sm text-charcoal/60">
            Set by{" "}
            <span className="font-semibold text-brown">{challenge.author}</span>
          </p>
        )}

        {isLive && <ArenaRules />}

        <ArenaWorkspace
          slug={challenge.slug}
          problem={<ProblemStatement challenge={challenge} />}
          sampleInput={sample?.input ?? ""}
          sampleOutput={sample?.output ?? ""}
          {...(!isLive && { practice: true })}
        />
      </section>
    </main>
  );
}
