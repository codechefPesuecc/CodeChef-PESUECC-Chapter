import type { Metadata } from "next";
import Link from "next/link";
import { getDailyChallenge } from "@/lib/challenges";
import ProblemStatement from "@/components/cp-arena/ProblemStatement";
import ArenaWorkspace from "@/components/cp-arena/ArenaWorkspace";
import ArenaRules from "@/components/cp-arena/ArenaRules";
import NextProblemCountdown from "@/components/cp-arena/NextProblemCountdown";

export const metadata: Metadata = {
  title: "Arena",
  description:
    "The daily competitive programming arena of the CodeChef PESUECC Chapter — solve the Problem of the Day, submit in the browser, and climb the live speed-bounty leaderboard.",
};

// Resolve the Problem of the Day per request — a statically prerendered page
// would freeze the daily rotation (and the release gate) at build time.
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

export default function CpArenaPage() {
  const challenge = getDailyChallenge();

  if (!challenge) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-bold text-chocolate">
            No live challenge yet
          </h1>
          <p className="mt-3 text-charcoal/70">
            The next Problem of the Day hasn&apos;t been published. Problem setters
            push new challenges to the <code className="font-mono">/challenges</code>{" "}
            directory — check back soon.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const difficultyStyle =
    DIFFICULTY_STYLES[challenge.difficulty] ?? "bg-bronze/15 text-bronze";
  const sample = challenge.samples[0];

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-7xl px-6 pt-6 pb-20">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
          <span className="font-semibold uppercase tracking-wider text-bronze">
            Problem of the Day
          </span>
          <span className="text-charcoal/40">·</span>
          <span className="text-charcoal/60">{formatDate(challenge.date)}</span>
          <span className="text-charcoal/40">·</span>
          <NextProblemCountdown />
          <span className="grow" />
          <Link
            href="/cp-arena/archive"
            className="text-charcoal/50 underline decoration-charcoal/20 underline-offset-2 transition-colors hover:text-bronze"
          >
            Archive
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            {challenge.title}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${difficultyStyle}`}
          >
            {challenge.difficulty}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {challenge.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-hairline bg-panel px-3 py-1 text-xs font-medium text-charcoal/70"
            >
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

        <ArenaRules />

        <ArenaWorkspace
          slug={challenge.slug}
          problem={<ProblemStatement challenge={challenge} />}
          sampleInput={sample?.input ?? ""}
          sampleOutput={sample?.output ?? ""}
        />
      </section>
    </main>
  );
}
