"use client";

import { Timer } from "lucide-react";
import { formatCountdown, type CountdownLevel } from "@/lib/algohunt/clock";
import ElapsedTimer from "./ElapsedTimer";
import { useParticipantState } from "./ParticipantStateProvider";
import { useEventClock } from "./useEventClock";

const LEVEL_STYLES: Record<CountdownLevel, string> = {
  normal: "border-hairline bg-panel text-chocolate dark:text-cream",
  warning: "border-amber-500/60 bg-amber-500/10 text-amber-800 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse dark:text-amber-200",
  critical: "border-red-500/70 bg-red-500/15 text-red-700 shadow-[0_0_16px_rgba(239,68,68,0.5)] animate-pulse dark:text-red-300",
  over: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

/**
 * The header clock. With a scheduled end it counts down (amber from 30 min, red from 10 min);
 * without one it falls back to the elapsed time. Display only: the server stops play at the end.
 */
export default function CountdownClock() {
  const { state } = useParticipantState();
  const { msLeft, level } = useEventClock();
  const { event, team } = state;
  const running = event.status === "LIVE" || event.status === "PAUSED";

  if (!running || team.status === "FINISHED") {
    if (event.startedAt === null) return null;
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-hairline px-2 py-1 text-xs text-charcoal/70">
        <Timer aria-hidden className="h-3.5 w-3.5" />
        <ElapsedTimer startedAt={event.startedAt} serverNow={state.serverNow} frozenMs={team.elapsedMs} />
      </span>
    );
  }

  if (msLeft === null || level === null) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-hairline px-2 py-1 text-xs text-charcoal/70">
        <Timer aria-hidden className="h-3.5 w-3.5" />
        <ElapsedTimer startedAt={event.startedAt} serverNow={state.serverNow} frozenMs={null} />
        <span className="sr-only">elapsed</span>
      </span>
    );
  }

  return (
    <span
      role="timer"
      aria-live={level === "critical" ? "polite" : "off"}
      aria-label={level === "over" ? "Time's up" : `${formatCountdown(msLeft)} remaining`}
      className={`inline-flex items-baseline gap-2 whitespace-nowrap rounded-md border px-2 py-1.5 sm:px-3 ${LEVEL_STYLES[level]}`}
    >
      {level === "over" ? (
        <span className="font-mono text-sm font-bold uppercase tracking-wider">Time&apos;s up</span>
      ) : (
        <>
          <span className="font-mono text-lg font-bold tabular-nums leading-none sm:text-xl">{formatCountdown(msLeft)}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">left</span>
        </>
      )}
    </span>
  );
}
