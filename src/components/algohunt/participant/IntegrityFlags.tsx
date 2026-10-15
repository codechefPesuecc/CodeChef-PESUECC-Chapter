"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { FREQUENT_AWAY_COUNT } from "@/lib/algohunt/integrity-rules";
import { useParticipantState } from "./ParticipantStateProvider";

/**
 * The team's integrity flags: how many times its laptops were recorded away from AlgoHunt while
 * playing. Shown on every page so the record is never a surprise; every team's count is also public
 * on the leaderboard.
 */
export default function IntegrityFlags() {
  const { state } = useParticipantState();
  const flags = state.integrity.awayCount;
  if (state.event.startedAt === null && flags === 0) return null;

  const tone = flags === 0
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    : flags >= FREQUENT_AWAY_COUNT
      ? "border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-300"
      : "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  const Icon = flags === 0 ? ShieldCheck : ShieldAlert;
  const explanation = flags === 0
    ? "No integrity flags. Leaving full screen or switching tabs or apps adds one. Every team's count shows on the leaderboard."
    : `Your team has ${flags} integrity flag${flags === 1 ? "" : "s"}: times a laptop left AlgoHunt while playing. Every team's count shows on the leaderboard.`;

  return (
    <span
      title={explanation}
      aria-label={explanation}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span className="font-mono tabular-nums">{flags}</span>
      <span className="hidden uppercase tracking-wider sm:inline">{flags === 1 ? "flag" : "flags"}</span>
    </span>
  );
}
