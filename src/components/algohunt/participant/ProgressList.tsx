"use client";

import { ArrowRight, Check, CircleDot, Lock } from "lucide-react";
import Link from "@/components/AppLink";
import { COPY } from "@/lib/algohunt/copy";
import { formatIST } from "@/lib/algohunt/format";
import { useParticipantState } from "./ParticipantStateProvider";

/** Every question's status. Reads the shared state (no second poller). */
export default function ProgressList() {
  const { state } = useParticipantState();
  const currentNumber = state.current?.number ?? null;

  return (
    <section className="space-y-3" aria-labelledby="ah-progress">
      <div className="flex items-baseline justify-between">
        <h1 id="ah-progress" className="font-display text-2xl font-bold">Progress</h1>
        <p className="text-sm text-charcoal/60">{state.solvedCount} of {state.totalStages} solved</p>
      </div>
      <ol className="space-y-2">
        {state.stages.map((stage) => {
          if (stage.state === "COMPLETED") {
            return (
              <li key={stage.number} className="lc-panel flex gap-3 p-4">
                <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">Question {stage.number}{stage.title ? `: ${stage.title}` : ""}</p>
                  {stage.solvedAt !== null && <p className="text-charcoal/70">Solved at {formatIST(stage.solvedAt)}</p>}
                  {stage.completedAt !== null && (
                    <p className="text-charcoal/70">Unlocked next at {formatIST(stage.completedAt)}</p>
                  )}
                </div>
              </li>
            );
          }
          if (stage.state === "LOCKED") {
            return (
              <li key={stage.number} className="lc-panel flex gap-3 p-4 opacity-70">
                <Lock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-charcoal/50" />
                <div className="text-sm">
                  <p className="font-semibold">Question {stage.number}</p>
                  <p className="text-charcoal/70">{COPY.locked}</p>
                </div>
              </li>
            );
          }
          const isCurrent = stage.number === currentNumber;
          const hunting = stage.state === "CODE_PENDING";
          return (
            <li key={stage.number} className="lc-panel flex gap-3 border-bronze p-4 ring-1 ring-bronze/50">
              <CircleDot aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-bronze" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">Question {stage.number}{stage.title ? `: ${stage.title}` : ""}</p>
                <p className="text-charcoal/70">{hunting ? "Solved: find a QR" : "Solving"}</p>
                {isCurrent && (
                  <Link
                    href={hunting ? "/algohunt/code" : "/algohunt/challenge"}
                    className="mecha-btn mecha-btn--ghost mecha-btn--sm mt-3"
                  >
                    {hunting ? "Enter code" : "Open question"}
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-charcoal/60">{COPY.noGoingBack}</p>
    </section>
  );
}
