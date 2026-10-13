"use client";

import { useEffect, useState } from "react";
import Link from "@/components/AppLink";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";
import { transitionOptions } from "@/components/admin/algohunt/control/controlModel";
import ReadinessStrip from "@/components/admin/algohunt/control/ReadinessStrip";
import { STATUS_TONE_CLASS, statusTone, withEvent } from "@/components/admin/algohunt/nav/navModel";
import { usePoll } from "@/components/algohunt/usePoll";
import { formatIST } from "@/lib/algohunt/format";
import type { AdminOverview } from "@/server/algohunt/admin/overview";
import {
  TONE_CLASS, formatRunning, formatWaiting, lowPoolMessage, poolTone, stuckTone, submissionsTone, systemTone,
} from "./overviewModel";

const SETUP_STATUSES = ["DRAFT", "CHECK_IN", "READY"];

type Stuck = AdminOverview["stuck"][number];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hairline bg-panel p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-wider text-bronze">{title}</h2>
      <dl className="mt-3 space-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value, tone = "ok" }: { label: string; value: React.ReactNode; tone?: keyof typeof TONE_CLASS }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-charcoal/70">{label}</dt>
      <dd className={`font-mono font-semibold ${TONE_CLASS[tone]}`}>{value}</dd>
    </div>
  );
}

export default function CommandCenter({ eventSlug }: { eventSlug: string }) {
  const url = `/api/admin/algohunt/overview?event=${encodeURIComponent(eventSlug)}`;
  const { data, error, online, lastUpdated, refresh } = usePoll<AdminOverview>(url, { intervalMs: 5000, jitterMs: 500 });
  const [unlocking, setUnlocking] = useState<Stuck | null>(null);
  const [pausing, setPausing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <p role="status" className="text-sm text-charcoal/70">
        {error ?? "Loading the command center…"}
      </p>
    );
  }

  // The server clock decides "running for", so a wrong laptop clock doesn't skew it.
  const now = tick + (data.serverNow - (lastUpdated ?? data.serverNow));
  const { event, counts, codePool, stuck, readiness, topTeams, recentActivity, health } = data;
  const tone = statusTone(event.status);
  const running = formatRunning(event.startedAt, now);
  const banner = lowPoolMessage(codePool);
  const pauseOption = transitionOptions(event.status).find(
    (o) => (event.status === "LIVE" && o.to === "PAUSED") || (event.status === "PAUSED" && o.to === "LIVE"),
  );
  const teamHref = (teamId: string) => withEvent(`/admin/algohunt/teams/${teamId}`, event.slug);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
            {event.name}
            {event.isTest && (
              <span className="mecha-chip ml-2 border border-yellow-500/50 bg-yellow-400/20 px-2 py-0.5 font-semibold text-yellow-800 dark:text-yellow-300">
                TEST
              </span>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-xl border px-3 py-1 font-display text-xl font-bold ${STATUS_TONE_CLASS[tone]}`}
              aria-label={`Event status: ${event.status}`}
            >
              {event.status === "LIVE" ? "● " : ""}{event.status.replace("_", " ")}
            </span>
            {event.startedAt !== null && (
              <span className="text-sm text-charcoal/70">
                started {formatIST(event.startedAt)}
                {running && event.status === "LIVE" ? ` · running ${running}` : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {pauseOption && (
            <button
              type="button"
              onClick={() => { setNotice(null); setPausing(true); }}
              className={`mecha-btn mecha-btn--sm ${pauseOption.danger ? "bg-red-600 text-white hover:bg-red-700" : "mecha-btn--solid"}`}
            >
              {pauseOption.label}
            </button>
          )}
          <Link href={withEvent("/admin/algohunt/control", event.slug)} className="mecha-btn mecha-btn--ghost mecha-btn--sm">
            Control →
          </Link>
        </div>
      </header>

      {(error || !online) && (
        <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          {online ? error : "Offline. Showing the last numbers we got; retrying."}
        </p>
      )}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {SETUP_STATUSES.includes(event.status) && <ReadinessStrip readiness={readiness} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Teams">
          <Row label="Checked in" value={`${counts.checkedIn}/${counts.teamsTotal}`} />
          <Row label="Finished" value={counts.finished} />
          <Row label="DQ" value={counts.disqualified} tone={counts.disqualified > 0 ? "warn" : "ok"} />
        </Card>
        <Card title="Code pool">
          <Row label="Active codes" value={codePool.active} tone={poolTone(codePool)} />
          <Row
            label="Waiting for code"
            value={<>{codePool.teamsWaitingForCode}{codePool.teamsWaitingForCode > 0 ? " ⚠" : ""}</>}
            tone={codePool.teamsWaitingForCode > 0 ? "warn" : "ok"}
          />
          <Row label="Redeemed (10 m)" value={codePool.redeemedLast10m} />
          <Row
            label="Suspicious (10 m)"
            value={counts.suspiciousCodeTeams10m}
            tone={counts.suspiciousCodeTeams10m > 0 ? "bad" : "ok"}
          />
          <Link
            href={withEvent("/admin/algohunt/codes", event.slug)}
            className="mecha-btn mecha-btn--ghost mecha-btn--sm mt-2 inline-block"
          >
            Generate batch → Codes
          </Link>
        </Card>
        <Card title="Submissions">
          <Row label="Total" value={counts.submissions} />
          <Row label="Accepted" value={counts.accepted} />
          <Row label="Rejected" value={counts.rejected} />
          <Row label="Judge errors (10 m)" value={counts.judgeErrors10m} tone={submissionsTone(counts)} />
        </Card>
        <Card title="System">
          {health.judge.ok ? (
            <>
              <Row label="Judge" value={`● ${health.judge.idle} idle / ${health.judge.busy} busy`} tone={systemTone(data)} />
              <Row label="Queue" value={health.judge.queued} tone={health.judge.queued > 0 ? "warn" : "ok"} />
            </>
          ) : (
            <Row label="Judge" value={`● ${health.judge.error}`} tone="bad" />
          )}
          <Row label="DB" value={health.db.ok ? `${health.db.latencyMs} ms` : "down"} tone={health.db.ok ? "ok" : "bad"} />
        </Card>
      </div>

      {banner && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
          ⚠ {banner}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-label="Stuck teams">
          <h2 className="font-display text-lg font-bold text-chocolate">Stuck teams</h2>
          <p className="text-xs text-charcoal/60">Solved the question, still waiting for a code.</p>
          {stuck.length === 0 ? (
            <p className="mt-3 text-sm text-charcoal/70">No team is waiting for a code.</p>
          ) : (
            <ul className="mt-3 divide-y divide-hairline rounded-2xl border border-hairline bg-panel">
              {stuck.map((team) => {
                const rowTone = stuckTone(team.waitingSinceMs);
                return (
                  <li key={team.teamId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <Link href={teamHref(team.teamId)} className="min-w-0 hover:underline">
                      <span className="font-mono text-xs text-bronze">{team.teamCode}</span>{" "}
                      <span className="font-medium text-chocolate">{team.teamName}</span>{" "}
                      <span className="text-charcoal/70">Q{team.stageNumber}</span>{" "}
                      <span className={`font-mono ${TONE_CLASS[rowTone]}`}>
                        {formatWaiting(team.waitingSinceMs)}{rowTone === "warn" ? " ⚠" : ""}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setNotice(null); setUnlocking(team); }}
                      className="mecha-btn mecha-btn--ghost mecha-btn--sm"
                    >
                      Unlock without code
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Top teams">
          <h2 className="font-display text-lg font-bold text-chocolate">Top teams</h2>
          {topTeams.length === 0 ? (
            <p className="mt-3 text-sm text-charcoal/70">Nobody has solved a question yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-hairline rounded-2xl border border-hairline bg-panel">
              {topTeams.map((team) => (
                <li key={team.teamCode} className="flex items-baseline justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-charcoal/60">{team.rank}.</span>{" "}
                    <span className="font-medium text-chocolate">{team.teamName}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-charcoal/70">
                    {team.questionsSolved}/{readiness.stages}
                    {team.finishedAt ? ` ${formatIST(team.finishedAt)}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-label="Recent activity">
          <h2 className="font-display text-lg font-bold text-chocolate">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-charcoal/70">Nothing has happened yet.</p>
          ) : (
            <ul className="mt-3 max-h-[28rem] divide-y divide-hairline overflow-y-auto rounded-2xl border border-hairline bg-panel">
              {recentActivity.map((item, index) => {
                const body = (
                  <>
                    <span className="font-mono text-xs text-charcoal/60">{formatIST(item.at)}</span>{" "}
                    <span className="text-chocolate">{item.text}</span>
                  </>
                );
                return (
                  <li key={`${item.at}-${index}`} className="p-3 text-sm">
                    {item.teamId ? <Link href={teamHref(item.teamId)} className="hover:underline">{body}</Link> : body}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmAction
        open={unlocking !== null}
        title={unlocking ? `Unlock Question ${unlocking.stageNumber + 1} for ${unlocking.teamName}?` : ""}
        consequences={
          unlocking
            ? `Skips the code for ${unlocking.teamName} and unlocks the next question right away. Use it when the pool is dry and the organizers decide to help. The reason is saved in the audit log.`
            : ""
        }
        confirmPhrase={unlocking?.teamCode ?? ""}
        requireReason
        confirmLabel="Unlock without code"
        onConfirm={async ({ reason, confirm }) => {
          if (!unlocking) return;
          await adminFetch("POST", `/api/admin/algohunt/teams/${unlocking.teamId}/override`, {
            action: "COMPLETE_STAGE", stageNumber: unlocking.stageNumber, reason, confirm,
          });
          setNotice(`Unlocked Question ${unlocking.stageNumber + 1} for ${unlocking.teamName}.`);
          refresh();
        }}
        onClose={() => setUnlocking(null)}
      />
      {pauseOption && (
        <ConfirmAction
          open={pausing}
          title={`${pauseOption.label}?`}
          consequences={pauseOption.consequences}
          confirmPhrase={event.slug}
          confirmLabel={pauseOption.label}
          danger={pauseOption.danger}
          onConfirm={async ({ confirm }) => {
            await adminFetch("POST", `/api/admin/algohunt/events/${event.id}/transition`, { to: pauseOption.to, confirm });
            setNotice(`Event moved to ${pauseOption.to}.`);
            refresh();
          }}
          onClose={() => setPausing(false)}
        />
      )}
    </div>
  );
}
