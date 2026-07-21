import type { Metadata } from "next";
import Link from "next/link";
import { getReleasedChallenges, getDailyChallenge } from "@/lib/challenges";

export const metadata: Metadata = {
  title: "Arena Archive",
  description:
    "Browse and practice past Problems of the Day from the CodeChef PESUECC Chapter Arena. Practice solves are judged against the hidden tests but don't affect the leaderboard.",
};

// Released set depends on the current date, so this must be resolved per request.
export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

export default function ArchivePage() {
  const challenges = getReleasedChallenges();
  const daily = getDailyChallenge();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
          <Link
            href="/cp-arena"
            className="text-charcoal/50 underline decoration-charcoal/20 underline-offset-2 transition-colors hover:text-bronze"
          >
            ← Arena
          </Link>
          <span className="text-charcoal/40">·</span>
          <span className="font-semibold uppercase tracking-wider text-bronze">
            Archive
          </span>
        </div>

        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
          Past problems
        </h1>
        <p className="mt-3 max-w-2xl text-charcoal/70">
          Every released Problem of the Day, open for practice. Practice solves
          are judged against the hidden tests for real feedback, but they
          don&apos;t change the speed-bounty leaderboard.
        </p>

        {challenges.length === 0 ? (
          <p className="mt-10 text-charcoal/60">No problems released yet.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {challenges.map((c) => {
              const isLive = daily?.slug === c.slug;
              const href = isLive ? "/cp-arena" : `/cp-arena/archive/${c.slug}`;
              const difficultyStyle =
                DIFFICULTY_STYLES[c.difficulty] ?? "bg-bronze/15 text-bronze";
              return (
                <li key={c.slug}>
                  <Link
                    href={href}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-hairline bg-panel px-5 py-4 shadow-sm transition-colors hover:border-bronze/50"
                  >
                    <span className="font-mono text-xs text-charcoal/50">
                      {formatDate(c.date)}
                    </span>
                    <span className="font-display text-lg font-semibold text-chocolate group-hover:text-bronze">
                      {c.title}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${difficultyStyle}`}
                    >
                      {c.difficulty}
                    </span>
                    {isLive && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        Live today
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs text-charcoal/40 transition-transform group-hover:translate-x-0.5">
                      {isLive ? "Solve →" : "Practice →"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
