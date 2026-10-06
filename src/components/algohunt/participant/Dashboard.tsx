"use client";

import { motion } from "motion/react";
import {
  ArrowRight, Ban, Check, CircleCheck, CircleDot, Flag, Hourglass, Lock, PartyPopper, UserCheck,
} from "lucide-react";
import Link from "@/components/AppLink";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { COPY } from "@/lib/algohunt/copy";
import { formatDuration, formatIST } from "@/lib/algohunt/format";
import type { ParticipantState } from "@/lib/algohunt/types";
import AnnouncementsCard from "./AnnouncementsCard";
import CodeEntrySlot from "./CodeEntrySlot";
import ElapsedTimer from "./ElapsedTimer";
import { useParticipantState } from "./ParticipantStateProvider";
import StatusChip from "./StatusChip";

/** Mirrors assertTeamCanPlay(ctx, "code") so the code box explains why it's unavailable. */
function codeBlockReason(state: ParticipantState): string | null {
  const { event, team } = state;
  if (event.status === "ENDED" || event.status === "ARCHIVED") return COPY.errors.EVENT_ENDED;
  if (["DRAFT", "CHECK_IN", "READY"].includes(event.status)) return COPY.errors.EVENT_NOT_LIVE;
  if (event.status === "PAUSED") return COPY.errors.EVENT_PAUSED;
  if (team.status === "DISQUALIFIED") return COPY.errors.TEAM_DISQUALIFIED;
  if (team.status === "REGISTERED") return COPY.errors.TEAM_NOT_CHECKED_IN;
  if (team.status === "FINISHED") return COPY.errors.TEAM_FINISHED;
  if (!event.codesEnabled) return COPY.errors.CODES_DISABLED;
  return null;
}

export default function Dashboard() {
  const { state } = useParticipantState();
  const { nextStep, current, team, event } = state;

  if (nextStep.kind === "WAIT_FOR_START" || nextStep.kind === "NOT_CHECKED_IN") {
    return (
      <MechaPanel label="STANDBY" index="AH 2.0">
        <div className="space-y-5 p-5 sm:p-8">
          {nextStep.kind === "WAIT_FOR_START" ? (
            <Hourglass aria-hidden className="h-8 w-8 text-bronze" />
          ) : (
            <UserCheck aria-hidden className="h-8 w-8 text-bronze" />
          )}
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {nextStep.kind === "WAIT_FOR_START" ? "Waiting for the organizers to start." : nextStep.message}
          </h1>
          {nextStep.kind === "WAIT_FOR_START" && <p className="text-charcoal/70">{nextStep.message}</p>}
          <div className="lc-panel p-4">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-charcoal/60">How it works</h2>
            <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium">
              {["Solve a question", "Find a QR on campus", "Enter its code", "Next question"].map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight aria-hidden className="h-4 w-4 text-bronze" />}
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-charcoal/70">Each code works once.</p>
          </div>
        </div>
      </MechaPanel>
    );
  }

  if (nextStep.kind === "FINISHED") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <MechaPanel label="FINISHED" index="AH 2.0" ticks>
          <div className="space-y-4 p-5 text-center sm:p-8">
            <PartyPopper aria-hidden className="mx-auto h-10 w-10 text-bronze" />
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{nextStep.message}</h1>
            <dl className="mx-auto grid max-w-sm grid-cols-2 gap-3 text-left">
              <div className="lc-panel p-3">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-charcoal/60">Finished at</dt>
                <dd className="font-mono font-semibold">{team.finishedAt !== null ? formatIST(team.finishedAt) : "—"}</dd>
              </div>
              <div className="lc-panel p-3">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-charcoal/60">Elapsed</dt>
                <dd className="font-mono font-semibold">{team.elapsedMs !== null ? formatDuration(team.elapsedMs) : "—"}</dd>
              </div>
            </dl>
            <Link href="/algohunt/leaderboard" className="mecha-btn mecha-btn--solid">
              View leaderboard
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </MechaPanel>
      </motion.div>
    );
  }

  if (nextStep.kind === "DISQUALIFIED" || nextStep.kind === "ENDED") {
    const Icon = nextStep.kind === "DISQUALIFIED" ? Ban : Flag;
    return (
      <div className="space-y-4">
        <MechaPanel label={nextStep.kind === "DISQUALIFIED" ? "DISQUALIFIED" : "ENDED"} index="AH 2.0">
          <div className="space-y-3 p-5 sm:p-8">
            <Icon aria-hidden className="h-8 w-8 text-bronze" />
            <h1 className="font-display text-2xl font-bold">{nextStep.message}</h1>
            <p className="text-sm text-charcoal/70">
              Questions solved: {state.solvedCount} of {state.totalStages}
            </p>
          </div>
        </MechaPanel>
        <AnnouncementsCard announcements={state.announcements} />
      </div>
    );
  }

  // SOLVE, FIND_CODE or PAUSED: the team has a current question (or is waiting on one).
  const hunting = current?.state === "CODE_PENDING";
  const blockReason = codeBlockReason(state);
  const canPlay = event.status === "LIVE" && team.status === "CHECKED_IN" && event.codesEnabled;
  const codeSlot = current && !current.isFinal && (
    <CodeEntrySlot stageNumber={current.number} canPlay={canPlay} disabledReason={blockReason} />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wider text-charcoal/70">
        <span>Team: {team.name}</span>
        <span>·</span>
        <span>{team.code}</span>
        <StatusChip kind={nextStep.kind} />
        <ElapsedTimer startedAt={event.startedAt} serverNow={state.serverNow} frozenMs={null} />
      </div>

      {current && (
        <motion.section
          key={`${current.number}-${current.state}`}
          initial={{ opacity: 0.4, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="lc-panel space-y-3 p-4 sm:p-5"
        >
          {hunting ? (
            <p className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <CircleCheck aria-hidden className="h-4 w-4" />
              Question {current.number} solved
            </p>
          ) : (
            <>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                Question {current.number} of {state.totalStages}
                {current.isFinal && " · Final"}
              </p>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="font-display text-xl font-bold">{current.challengeTitle}</h1>
                <span className="text-sm text-charcoal/70">
                  Status: {current.state === "IN_PROGRESS" ? "Attempted, not solved yet" : "Not solved yet"}
                </span>
              </div>
              <Link href="/algohunt/challenge" className="mecha-btn mecha-btn--ghost">
                Open question
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </>
          )}
        </motion.section>
      )}

      <section aria-label="Next step" className={`rounded-md border-l-4 p-4 ${hunting ? "border-amber-500 bg-amber-500/10" : "border-bronze bg-bronze/10"}`}>
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-charcoal/60">Next step</p>
        <p className="mt-1 font-display text-2xl font-bold leading-snug sm:text-3xl">{nextStep.message}</p>
      </section>

      {hunting
        ? codeSlot
        : codeSlot && (
          <details className="group">
            <summary className="cursor-pointer select-none text-sm font-semibold text-charcoal/80">
              Found a QR already?
            </summary>
            <div className="mt-3">{codeSlot}</div>
          </details>
        )}

      <section className="lc-panel p-4" aria-label="Progress">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-charcoal/60">Progress</h2>
          <Link href="/algohunt/progress" className="text-xs font-semibold text-bronze">Details</Link>
        </div>
        <ol className="mt-3 flex flex-wrap gap-2">
          {state.stages.map((stage) => {
            const Icon = stage.state === "COMPLETED" ? Check : stage.state === "LOCKED" ? Lock : CircleDot;
            return (
              <li
                key={stage.number}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                  stage.state === "COMPLETED"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : stage.state === "LOCKED"
                      ? "border-hairline text-charcoal/40"
                      : "border-bronze bg-bronze/15 text-bronze"
                }`}
              >
                <Icon aria-hidden className="h-4 w-4" />
                <span className="sr-only">Question {stage.number}: {stage.state.toLowerCase().replace("_", " ")}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-charcoal/60">{state.solvedCount} of {state.totalStages} solved</p>
      </section>

      <AnnouncementsCard announcements={state.announcements} />
    </div>
  );
}
