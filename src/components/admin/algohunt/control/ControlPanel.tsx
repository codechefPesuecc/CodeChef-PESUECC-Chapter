"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/AppLink";
import { formatIST } from "@/lib/algohunt/format";
import type { EventStatus } from "@/lib/algohunt/types";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { STATUS_TONE_CLASS, statusTone, withEvent } from "@/components/admin/algohunt/nav/navModel";
import {
  FLAG_ROWS, readinessIssues, transitionOptions,
  type ControlStage, type FlagKey, type Readiness, type TransitionOption,
} from "./controlModel";
import { adminFetch } from "./adminFetch";
import ReadinessStrip from "./ReadinessStrip";

export interface ControlEvent {
  id: string;
  slug: string;
  name: string;
  status: EventStatus;
  isTest: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  endedAt: number | null;
  submissionsEnabled: boolean;
  codesEnabled: boolean;
  leaderboardVisible: boolean;
}

type Pending =
  | { kind: "transition"; option: TransitionOption }
  | { kind: "flag"; key: FlagKey; next: boolean }
  | { kind: "stage"; stage: ControlStage; next: boolean };

const SETUP_STATUSES: readonly EventStatus[] = ["DRAFT", "CHECK_IN", "READY"];

function timeLine(event: ControlEvent): string {
  const parts: string[] = [];
  if (event.startedAt) parts.push(`Started ${formatIST(event.startedAt, { withDate: true })} IST`);
  if (event.status === "PAUSED" && event.pausedAt) parts.push(`Paused ${formatIST(event.pausedAt)} IST`);
  if (event.endedAt) parts.push(`Ended ${formatIST(event.endedAt, { withDate: true })} IST`);
  return parts.length > 0 ? parts.join(" · ") : "Not started yet.";
}

export default function ControlPanel({
  event, stages, readiness,
}: {
  event: ControlEvent;
  stages: ControlStage[];
  readiness: Readiness;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const options = transitionOptions(event.status);
  const issues = readinessIssues(readiness);
  const flagValue: Record<FlagKey, boolean> = {
    submissionsEnabled: event.submissionsEnabled,
    codesEnabled: event.codesEnabled,
    leaderboardVisible: event.leaderboardVisible,
  };

  function dialog(p: Pending) {
    if (p.kind === "transition") {
      const heads = p.option.to === "LIVE" && event.status === "READY" && issues.length > 0
        ? `\n\nHeads up, this event isn't fully ready:\n${issues.map((i) => `• ${i}`).join("\n")}\nYou can still start it.`
        : "";
      return {
        title: `${p.option.label}?`,
        consequences: p.option.consequences + heads,
        requireReason: false,
        confirmLabel: p.option.label,
        danger: p.option.danger,
        run: (c: { confirm: string }) =>
          adminFetch<{ message?: string }>("POST", `/api/admin/algohunt/events/${event.id}/transition`, { to: p.option.to, confirm: c.confirm }),
        done: `Event moved to ${p.option.to}.`,
      };
    }
    if (p.kind === "flag") {
      const row = FLAG_ROWS.find((f) => f.key === p.key)!;
      const copy = p.next ? row.turnOn : row.turnOff;
      return {
        title: copy.title,
        consequences: copy.consequences,
        requireReason: true,
        confirmLabel: p.next ? "Turn on" : "Turn off",
        danger: !p.next,
        run: (c: { confirm: string; reason?: string }) =>
          adminFetch<{ message?: string }>("PATCH", `/api/admin/algohunt/events/${event.id}/flags`, { [p.key]: p.next, reason: c.reason, confirm: c.confirm }),
        done: `${row.label} turned ${p.next ? "on" : "off"}.`,
      };
    }
    return {
      title: `${p.next ? "Enable" : "Disable"} Question ${p.stage.stageNumber}?`,
      consequences: p.next
        ? `Teams can submit to Question ${p.stage.stageNumber} again.`
        : `Submissions to Question ${p.stage.stageNumber} are blocked. A team on it needs Unlock without a code to move on.`,
      requireReason: true,
      confirmLabel: p.next ? "Enable" : "Disable",
      danger: !p.next,
      run: (c: { confirm: string; reason?: string }) =>
        adminFetch<{ message?: string }>("PATCH", `/api/admin/algohunt/stages/${p.stage.id}`, { enabled: p.next, reason: c.reason, confirm: c.confirm }),
      done: `Question ${p.stage.stageNumber} ${p.next ? "enabled" : "disabled"}.`,
    };
  }

  const active = pending ? dialog(pending) : null;
  const tone = statusTone(event.status);
  const readOnly = event.status === "ARCHIVED";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-hairline bg-panel p-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
          {event.name} <span className="normal-case">({event.slug})</span>
          {event.isTest && (
            <span className="mecha-chip ml-2 border border-yellow-500/50 bg-yellow-400/20 px-2 py-0.5 font-semibold text-yellow-800 dark:text-yellow-300">
              TEST
            </span>
          )}
        </p>
        <p
          className={`mt-2 inline-block rounded-xl border px-4 py-2 font-display text-3xl font-bold tracking-tight ${STATUS_TONE_CLASS[tone]}`}
          aria-label={`Event status: ${event.status}`}
        >
          {event.status === "LIVE" ? "● " : ""}{event.status.replace("_", " ")}
        </p>
        <p className="mt-2 text-sm text-charcoal/70">{timeLine(event)}</p>

        {options.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {options.map((option) => (
              <button
                key={option.to}
                type="button"
                onClick={() => { setNotice(null); setPending({ kind: "transition", option }); }}
                className={
                  option.primary
                    ? `mecha-btn text-white ${option.danger ? "bg-red-600 hover:bg-red-700" : "mecha-btn--solid"}`
                    : `mecha-btn mecha-btn--ghost mecha-btn--sm ${option.danger ? "text-red-600 dark:text-red-400" : ""}`
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-charcoal/60">This event is archived. No further moves are possible.</p>
        )}
        {notice && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      </section>

      {SETUP_STATUSES.includes(event.status) && (
        <section aria-label="Ready to start">
          <h2 className="mb-2 font-display text-lg font-bold text-chocolate">Ready to start?</h2>
          <ReadinessStrip readiness={readiness} />
        </section>
      )}

      <section aria-label="Emergency switches">
        <h2 className="font-display text-lg font-bold text-chocolate">Emergency switches</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          {readOnly ? "This event is archived, so the switches are read-only." : "Each change needs a reason and the event name typed in."}
        </p>
        <ul className="mt-3 divide-y divide-hairline rounded-2xl border border-hairline bg-panel">
          {FLAG_ROWS.map((row) => {
            const on = flagValue[row.key];
            return (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-chocolate">
                    {row.label}{" "}
                    <span className={`font-mono text-xs ${on ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}>
                      {on ? "ON" : "OFF"}
                    </span>
                  </p>
                  <p className="text-xs text-charcoal/60">{row.explanation}</p>
                </div>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => { setNotice(null); setPending({ kind: "flag", key: row.key, next: !on }); }}
                  className={`mecha-btn mecha-btn--sm ${on ? "mecha-btn--ghost" : "mecha-btn--solid"}`}
                >
                  {on ? "Turn off" : "Turn on"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Questions">
        <h2 className="font-display text-lg font-bold text-chocolate">Questions</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Disabling a question blocks submissions to it. A team on it needs “Unlock without a code” to pass it.
        </p>
        {stages.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/70">No questions are set up for this event yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline rounded-2xl border border-hairline bg-panel">
            {stages.map((stage) => (
              <li key={stage.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-chocolate">
                    Question {stage.stageNumber}: {stage.title}
                    {stage.isFinal && <span className="mecha-chip ml-2 border border-bronze/40 bg-bronze/10 px-2 py-0.5 font-mono text-[11px] text-bronze">FINAL</span>}
                    {!stage.verified && <span className="mecha-chip ml-2 border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-700 dark:text-red-300">UNVERIFIED</span>}
                  </p>
                  <p className={`font-mono text-xs ${stage.enabled ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}>
                    {stage.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => { setNotice(null); setPending({ kind: "stage", stage, next: !stage.enabled }); }}
                  className={`mecha-btn mecha-btn--sm ${stage.enabled ? "mecha-btn--ghost" : "mecha-btn--solid"}`}
                >
                  {stage.enabled ? "Disable" : "Enable"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wider">
        <Link href={withEvent("/admin/algohunt/announcements", event.slug)} className="text-bronze hover:underline">
          Broadcast an announcement →
        </Link>
        <Link href={withEvent("/admin/algohunt/codes", event.slug)} className="text-bronze hover:underline">
          Code pool →
        </Link>
      </p>

      <ConfirmAction
        open={active !== null}
        title={active?.title ?? ""}
        consequences={active?.consequences ?? ""}
        confirmPhrase={event.slug}
        requireReason={active?.requireReason}
        confirmLabel={active?.confirmLabel}
        danger={active?.danger}
        onConfirm={async (c) => {
          if (!active) return;
          const result = await active.run({ confirm: c.confirm, reason: c.reason });
          setNotice(result.message ?? active.done);
          router.refresh();
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
