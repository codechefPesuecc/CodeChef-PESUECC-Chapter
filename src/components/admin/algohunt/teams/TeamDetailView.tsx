"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/AppLink";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";
import { withEvent } from "@/components/admin/algohunt/nav/navModel";
import { formatDuration, formatIST } from "@/lib/algohunt/format";
import type { AdminTeamDetail, TimelineEntry } from "@/server/algohunt/admin/teams";
import {
  DQ_WARNING, TIMELINE_FILTERS, filterTimeline, revertWarning, stageActions,
  type StageAction, type TimelineFilter,
} from "./teamDetailModel";
import { TEAM_STATUS_CLASS, TEAM_STATUS_LABEL } from "./teamsModel";

type Pending =
  | { kind: "stage"; action: StageAction }
  | { kind: "disqualify" }
  | { kind: "reinstate" }
  | { kind: "reset" };

const STATE_LABEL: Record<string, string> = {
  LOCKED: "Locked", AVAILABLE: "Available", IN_PROGRESS: "In progress", CODE_PENDING: "Waiting for code", COMPLETED: "Completed",
};

const when = (at: number | null | undefined) => (at ? formatIST(at) : "—");

export default function TeamDetailView({
  detail, timeline, serverNow,
}: {
  detail: AdminTeamDetail;
  timeline: TimelineEntry[];
  serverNow: number;
}) {
  const router = useRouter();
  const { team, event, members, progress, codesUsed, codeAttempts } = detail;
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const actions = stageActions(detail);
  const base = `/api/admin/algohunt/teams/${team.id}`;
  const shownTimeline = filterTimeline(timeline, filter);
  const elapsed = event.startedAt ? formatDuration((team.finishedAt ?? serverNow) - event.startedAt) : null;
  const listHref = withEvent("/admin/algohunt/teams", event.slug);
  const isDq = team.status === "DISQUALIFIED";

  function done(message: string) {
    setNotice(message);
    setActionError(null);
    router.refresh();
  }

  async function checkIn() {
    setCheckingIn(true);
    setNotice(null);
    setActionError(null);
    try {
      await adminFetch("POST", `${base}/checkin`);
      done(`${team.teamName} is checked in.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  }

  async function copyPassword() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const dialog = (() => {
    if (!pending) return null;
    if (pending.kind === "stage") {
      const { action } = pending;
      const revert = action.action === "REVERT_STAGE";
      return {
        title: revert ? `Revert Question ${action.stageNumber}?` : `${action.label}?`,
        consequences: revert
          ? `Marks Question ${action.stageNumber} as not completed for ${team.teamName}.\n${revertWarning(action.isFinal)}`
          : action.isFinal
            ? `Completes the final question for ${team.teamName} without a solution and finishes the team.`
            : `Completes Question ${action.stageNumber} for ${team.teamName} without a code and unlocks Question ${action.stageNumber + 1} right away.`,
        requireReason: true,
        confirmLabel: action.label,
        danger: revert,
        run: async (c: { confirm: string; reason?: string }) => {
          await adminFetch("POST", `${base}/override`, {
            action: action.action, stageNumber: action.stageNumber, reason: c.reason, confirm: c.confirm,
          });
          done(revert ? `Question ${action.stageNumber} reverted.` : `Question ${action.stageNumber} completed.`);
        },
      };
    }
    if (pending.kind === "disqualify") {
      return {
        title: `Disqualify ${team.teamName}?`,
        consequences: DQ_WARNING,
        requireReason: true,
        confirmLabel: "Disqualify",
        danger: true,
        run: async (c: { confirm: string; reason?: string }) => {
          await adminFetch("POST", `${base}/disqualify`, { reason: c.reason, confirm: c.confirm });
          done(`${team.teamName} is disqualified.`);
        },
      };
    }
    if (pending.kind === "reinstate") {
      return {
        title: `Reinstate ${team.teamName}?`,
        consequences: "The team goes back to the status it had and can play again. Its progress is kept.",
        requireReason: true,
        confirmLabel: "Reinstate",
        danger: false,
        run: async (c: { confirm: string; reason?: string }) => {
          await adminFetch("POST", `${base}/reinstate`, { reason: c.reason, confirm: c.confirm });
          done(`${team.teamName} is reinstated.`);
        },
      };
    }
    return {
      title: `Reset password for ${team.teamName}?`,
      consequences: "Creates a new password and logs out every device of this team. The old password stops working at once.",
      requireReason: false,
      confirmLabel: "Reset password",
      danger: true,
      run: async (c: { confirm: string }) => {
        const result = await adminFetch<{ password: string }>("POST", `${base}/reset-password`, { confirm: c.confirm });
        setNewPassword(result.password);
        setCopied(false);
        done("Password reset.");
      },
    };
  })();

  return (
    <div className="space-y-8">
      <Link href={listHref} className="font-mono text-xs uppercase tracking-wider text-bronze hover:underline">
        ← All teams
      </Link>

      <section className="rounded-2xl border border-hairline bg-panel p-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">{team.teamCode}</p>
        <h2 className="mt-1 flex flex-wrap items-center gap-3 font-display text-2xl font-bold text-chocolate">
          {team.teamName}
          <span className={`rounded-full border px-3 py-0.5 font-sans text-sm font-normal ${TEAM_STATUS_CLASS[team.status]}`}>
            {TEAM_STATUS_LABEL[team.status] ?? team.status}
          </span>
        </h2>
        <p className="mt-1 text-sm text-charcoal/70">{team.college ?? "No college listed"}</p>
        <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt className="text-charcoal/70">Checked in</dt><dd className="font-mono">{when(team.checkedInAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-charcoal/70">Event started</dt><dd className="font-mono">{when(event.startedAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-charcoal/70">Finished</dt><dd className="font-mono">{when(team.finishedAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-charcoal/70">Elapsed</dt><dd className="font-mono">{elapsed ?? "—"}</dd></div>
        </dl>
        {isDq && team.disqualificationReason && (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">Disqualified: {team.disqualificationReason}</p>
        )}
      </section>

      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      <section aria-label="Actions" className="space-y-3">
        <h2 className="font-display text-lg font-bold text-chocolate">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {team.status === "REGISTERED" && (
            <button type="button" disabled={checkingIn} onClick={checkIn} className="mecha-btn mecha-btn--solid mecha-btn--sm">
              {checkingIn ? "Checking in…" : "Check in"}
            </button>
          )}
          <button type="button" onClick={() => { setNotice(null); setPending({ kind: "reset" }); }} className="mecha-btn mecha-btn--ghost mecha-btn--sm">
            Reset password
          </button>
          {isDq ? (
            <button type="button" onClick={() => { setNotice(null); setPending({ kind: "reinstate" }); }} className="mecha-btn mecha-btn--solid mecha-btn--sm">
              Reinstate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setNotice(null); setPending({ kind: "disqualify" }); }}
              className="mecha-btn mecha-btn--ghost mecha-btn--sm text-red-600 dark:text-red-400"
            >
              Disqualify
            </button>
          )}
        </div>
        {newPassword && (
          <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              All devices of this team are now logged out. Give this password to the team captain. It is shown only once.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="rounded bg-hairline/60 px-3 py-1.5 font-mono text-lg tracking-wider text-chocolate select-all">{newPassword}</code>
              <button type="button" onClick={copyPassword} className="mecha-btn mecha-btn--ghost mecha-btn--sm">
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={() => setNewPassword(null)} className="mecha-btn mecha-btn--ghost mecha-btn--sm">
                Hide
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Members">
        <h2 className="font-display text-lg font-bold text-chocolate">Members</h2>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/70">No members on file.</p>
        ) : (
          <ul className="mt-2 divide-y divide-hairline rounded-2xl border border-hairline bg-panel">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span className="font-medium text-chocolate">
                  {m.name}
                  {m.isCaptain && <span className="ml-2 rounded-full border border-bronze/40 px-2 py-0.5 font-mono text-[10px] uppercase text-bronze">Captain</span>}
                </span>
                <span className="font-mono text-xs text-charcoal/70">{[m.email, m.phone].filter(Boolean).join(" · ") || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Questions">
        <h2 className="font-display text-lg font-bold text-chocolate">Questions</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-hairline bg-panel">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-wider text-bronze">
                <th scope="col" className="px-3 py-2 font-medium">Question</th>
                <th scope="col" className="px-3 py-2 font-medium">State</th>
                <th scope="col" className="px-3 py-2 font-medium">Solved at</th>
                <th scope="col" className="px-3 py-2 font-medium">Code used</th>
                <th scope="col" className="px-3 py-2 font-medium">Completed at</th>
                <th scope="col" className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {progress.stages.map((row) => {
                const n = row.stage.stageNumber;
                const code = codesUsed.find((c) => c.stageNumber === n);
                const action = actions.get(n);
                return (
                  <tr key={row.stage.id}>
                    <td className="px-3 py-2">
                      <span className="font-mono">Q{n}</span>{" "}
                      <span className="text-chocolate">{row.challengeTitle}</span>
                      {row.stage.isFinal && <span className="ml-1 text-xs text-bronze">(final)</span>}
                    </td>
                    <td className="px-3 py-2">{STATE_LABEL[row.state] ?? row.state}</td>
                    <td className="px-3 py-2 font-mono text-xs">{when(row.progress?.challengeSolvedAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {code ? `#${String(code.serial).padStart(3, "0")} · ${formatIST(code.usedAt)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="font-mono">{when(row.progress?.completedAt)}</span>
                      {row.progress?.manualOverride && (
                        <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                          override{row.progress.overrideReason ? `: ${row.progress.overrideReason}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {action && (
                        <button
                          type="button"
                          onClick={() => { setNotice(null); setPending({ kind: "stage", action }); }}
                          className={`mecha-btn mecha-btn--ghost mecha-btn--sm ${action.action === "REVERT_STAGE" ? "text-red-600 dark:text-red-400" : ""}`}
                        >
                          {action.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Timeline">
        <h2 className="font-display text-lg font-bold text-chocolate">Timeline</h2>
        <p className="text-xs text-charcoal/60">Oldest first. Times are IST.</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter the timeline">
          {TIMELINE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                filter === f.key ? "border-bronze bg-bronze/15 text-chocolate" : "border-hairline text-charcoal/70 hover:text-chocolate"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {shownTimeline.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/70">Nothing here yet.</p>
        ) : (
          <ul className="mt-3 max-h-[32rem] divide-y divide-hairline overflow-y-auto rounded-2xl border border-hairline bg-panel">
            {shownTimeline.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="p-3 text-sm">
                <span className="font-mono text-xs text-charcoal/60">{formatIST(entry.at)}</span>{" "}
                <span className="text-chocolate">{entry.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Code attempts">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-chocolate">Code attempts</h2>
          <Link href={withEvent("/admin/algohunt/submissions", event.slug)} className="text-sm text-bronze underline">
            Submissions browser (filter by <span className="font-mono">{team.teamCode}</span>) →
          </Link>
        </div>
        <p className="text-xs text-charcoal/60">The last 50. Use this to settle “we entered the code at 11:02” disputes.</p>
        {codeAttempts.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/70">No code attempts yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-2xl border border-hairline bg-panel">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-wider text-bronze">
                  <th scope="col" className="px-3 py-2 font-medium">Time</th>
                  <th scope="col" className="px-3 py-2 font-medium">Question</th>
                  <th scope="col" className="px-3 py-2 font-medium">Typed code</th>
                  <th scope="col" className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {codeAttempts.map((a, index) => (
                  <tr key={`${a.createdAt}-${index}`}>
                    <td className="px-3 py-2 font-mono text-xs">{formatIST(a.createdAt)}</td>
                    <td className="px-3 py-2 font-mono">{a.stageNumber === null ? "—" : `Q${a.stageNumber}`}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.submittedCode ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmAction
        open={dialog !== null}
        title={dialog?.title ?? ""}
        consequences={dialog?.consequences ?? ""}
        confirmPhrase={team.teamCode}
        requireReason={dialog?.requireReason}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        onConfirm={(c) => dialog?.run(c)}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
