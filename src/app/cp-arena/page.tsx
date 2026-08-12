import type { Metadata } from "next";
import Link from "next/link";
import { getReleasedChallenges, getDailyChallenge } from "@/lib/challenges";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import NextProblemCountdown from "@/components/cp-arena/NextProblemCountdown";

export const metadata: Metadata = {
  title: "Arena",
  description:
    "The daily competitive programming arena of the CodeChef PESUECC Chapter — solve the Problem of the Day, browse past challenges, and climb the live speed-bounty leaderboard.",
};

// Released set depends on the current date, so this must be resolved per request.
export const dynamic = "force-dynamic";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Hard: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function CpArenaPage() {
  const daily = getDailyChallenge();
  const allReleased = getReleasedChallenges();

  // Past questions = everything except today's live problem.
  const pastChallenges = daily
    ? allReleased.filter((c) => c.slug !== daily.slug)
    : allReleased;

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
          <span className="font-semibold uppercase tracking-wider text-bronze">
            Arena
          </span>
          <span className="text-charcoal/40">·</span>
          <NextProblemCountdown />
        </div>

        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
          CP Arena
        </h1>
        <p className="mt-3 max-w-2xl text-charcoal/70">
          Sharpen your skills with the daily Problem of the Day, or practice any
          past challenge. Practice solves are judged against hidden tests for
          real feedback, but they don&apos;t affect the speed-bounty leaderboard.
        </p>

        {/* ━━━━━━━━━━━━━━━━━━ Problem of the Day ━━━━━━━━━━━━━━━━━━ */}
        <h2 className="mt-10 font-display text-lg font-bold tracking-tight text-chocolate sm:text-xl">
          Problem of the Day
        </h2>

        {daily ? (
          <Link href={`/cp-arena/solve/${daily.slug}`} className="group mt-4 block">
            <MechaPanel
              ticks
              bodyClassName="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7"
            >
              {/* Decorative accent bar */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-bronze"
              />

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Meta line: date + live badge */}
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="text-charcoal/50">
                      {formatDateLong(daily.date)}
                    </span>
                    <span className="mecha-chip bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Live today
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-2 text-balance font-display text-2xl font-bold tracking-tight text-chocolate transition-colors group-hover:text-bronze sm:text-3xl">
                    {daily.title}
                  </h3>

                  {/* Difficulty + tags */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`mecha-chip ${DIFFICULTY_STYLES[daily.difficulty] ?? "bg-bronze/15 text-bronze"}`}
                    >
                      {daily.difficulty}
                    </span>
                    {daily.tags.map((tag) => (
                      <span
                        key={tag}
                        className="mecha-chip bg-bronze/10 text-brown"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Author */}
                  {daily.author && (
                    <p className="mt-3 text-sm text-charcoal/60">
                      Set by{" "}
                      <span className="font-semibold text-brown">
                        {daily.author}
                      </span>
                    </p>
                  )}
                </div>

                {/* Solve CTA */}
                <span className="mecha-btn mecha-btn--solid mt-1 shrink-0 transition-transform group-hover:translate-x-0.5">
                  Solve →
                </span>
              </div>
            </MechaPanel>
          </Link>
        ) : (
          <MechaPanel bodyClassName="px-6 py-6" className="mt-4">
            <p className="text-charcoal/60">
              No live challenge yet. The next Problem of the Day hasn&apos;t been
              published — check back soon.
            </p>
          </MechaPanel>
        )}

        {/* ━━━━━━━━━━━━━━━━━━ Past Questions ━━━━━━━━━━━━━━━━━━ */}
        <h2 className="mt-14 font-display text-lg font-bold tracking-tight text-chocolate sm:text-xl">
          Past Questions
        </h2>

        {pastChallenges.length === 0 ? (
          <p className="mt-4 text-charcoal/60">
            No past problems yet — today&apos;s is the first!
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pastChallenges.map((c) => {
              const difficultyStyle =
                DIFFICULTY_STYLES[c.difficulty] ?? "bg-bronze/15 text-bronze";
              return (
                <li key={c.slug}>
                  <Link
                    href={`/cp-arena/archive/${c.slug}`}
                    className="group block"
                  >
                    <MechaPanel bodyClassName="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <span className="font-mono text-xs text-charcoal/50">
                        {formatDateShort(c.date)}
                      </span>
                      <span className="font-display text-lg font-semibold text-chocolate group-hover:text-bronze">
                        {c.title}
                      </span>
                      <span className={`mecha-chip ${difficultyStyle}`}>
                        {c.difficulty}
                      </span>
                      <span className="ml-auto font-mono text-xs text-charcoal/40 transition-transform group-hover:translate-x-0.5">
                        Practice →
                      </span>
                    </MechaPanel>
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
