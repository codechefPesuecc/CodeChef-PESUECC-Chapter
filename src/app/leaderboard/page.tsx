import type { Metadata } from "next";
import LeaderboardView from "@/components/cp-arena/LeaderboardView";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "The CodeChef PESUECC Chapter CP Arena leaderboard — today's speed-bounty standings, this month's totals, and the all-time rankings.",
};

export default function LeaderboardPage() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-8 pb-24">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
          CP Arena
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
          Leaderboard
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-charcoal/70">
          Points are earned by finishing the daily Problem of the Day fast — the
          faster your accepted solve, the more you earn. Today shows the live
          speed-bounty race; monthly and all-time sum your daily points.
        </p>
        <div className="mt-8">
          <LeaderboardView />
        </div>
      </section>
    </main>
  );
}
