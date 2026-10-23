"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Laptop, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { usePoll } from "@/components/algohunt/usePoll";
import { formatIST } from "@/lib/algohunt/format";
import { AWAY_REASONS, type IntegrityReason } from "@/lib/algohunt/types";
import type { IntegrityOverview, TeamIntegrityView } from "@/server/algohunt/admin/integrity";

const REASON_LABEL: Record<IntegrityReason, string> = {
  FULLSCREEN: "Left full screen",
  HIDDEN: "Switched tab or app",
  BLUR: "Another window in focus",
  RIGHT_CLICK: "Right-clicked",
  COPY: "Tried to copy",
  PASTE: "Pasted code from outside",
  SCREENSHOT: "Screenshot key",
  SHORTCUT: "Developer tools, print or view-source key",
  AUTOMATION: "Automated typing",
};

/** A blocked action is flagged on the spot: it has no time away to show. */
const isInstant = (reasons: readonly IntegrityReason[]) =>
  !reasons.some((reason) => (AWAY_REASONS as readonly string[]).includes(reason));

const SEVERITY_CLASS = {
  high: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
};

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

const shortId = (deviceId: string) => deviceId.slice(-6);

/**
 * Who played from where, and how long laptops spent away from AlgoHunt. Refreshes every 10 s.
 * Signals for a human to check (ask the team, look at the timeline); nothing here acts on its own.
 */
export default function IntegrityAdmin({ eventSlug, initial }: { eventSlug: string; initial: IntegrityOverview }) {
  const poll = usePoll<IntegrityOverview & { ok: true }>(
    `/api/admin/algohunt/integrity?event=${encodeURIComponent(eventSlug)}`,
    { intervalMs: 10_000, jitterMs: 1_000 },
  );
  const data = poll.data ?? initial;
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const teams = onlyFlagged ? data.teams.filter((team) => team.alerts.length > 0) : data.teams;

  const toggle = (teamId: string) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    return next;
  });

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Teams with alerts", data.totals.teamsWithAlerts],
          ["Serious alerts", data.totals.highAlerts],
          ["Phones logged in", data.totals.phones],
          ["Browsers shared by teams", data.totals.sharedDevices],
          ["Flags", data.totals.awayEpisodes],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-hairline bg-panel p-3">
            <dt className="text-[11px] uppercase tracking-wider text-charcoal/60">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-chocolate">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-charcoal/60">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
          Only teams with alerts
        </label>
        <span>
          Updated {formatIST(poll.lastUpdated ?? data.generatedAt)} IST
          {poll.error ? ` · ${poll.error}` : ""}
        </span>
      </div>

      {teams.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-panel p-6 text-sm text-charcoal/70">
          {onlyFlagged ? "No team has an alert right now." : "No teams in this event yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => (
            <TeamRow key={team.teamId} team={team} open={expanded.has(team.teamId)} onToggle={() => toggle(team.teamId)} />
          ))}
        </ul>
      )}

      <p className="text-xs text-charcoal/60">
        Flags are recorded on laptops only, while the event is live and the team can play: time away (full screen,
        tabs, other apps) and blocked actions (right-click, copy, pasting outside code, screenshot or developer-tool
        keys, automated typing). A stretch with no return usually means the page was closed or the laptop slept while
        away. Signals come from the browser, so treat them as a reason to talk to the team, not as proof.
      </p>
    </div>
  );
}

function TeamRow({ team, open, onToggle }: { team: TeamIntegrityView; open: boolean; onToggle: () => void }) {
  const laptops = team.devices.filter((device) => device.kind === "DESKTOP").length;
  const phones = team.devices.length - laptops;
  const Icon = team.alerts.length > 0 ? ShieldAlert : ShieldCheck;

  return (
    <li className="rounded-xl border border-hairline bg-panel">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-start gap-3 p-4 text-left">
        {open ? <ChevronDown aria-hidden className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight aria-hidden className="mt-1 h-4 w-4 shrink-0" />}
        <Icon
          aria-hidden
          className={`mt-0.5 h-5 w-5 shrink-0 ${team.alerts.some((a) => a.severity === "high") ? "text-red-600" : team.alerts.length > 0 ? "text-amber-600" : "text-emerald-600"}`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-chocolate">
            {team.teamName} <span className="font-mono text-xs text-charcoal/60">{team.teamCode} · {team.status}</span>
          </p>
          {team.alerts.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {team.alerts.map((alert) => (
                <li key={alert.kind} className={`rounded-md border px-2 py-1 text-xs ${SEVERITY_CLASS[alert.severity]}`}>
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-4 font-mono text-xs text-charcoal/70">
          <span className="inline-flex items-center gap-1"><Laptop aria-hidden className="h-3.5 w-3.5" />{laptops}</span>
          <span className={`inline-flex items-center gap-1 ${phones > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
            <Smartphone aria-hidden className="h-3.5 w-3.5" />{phones}
          </span>
          <span>away {team.away.count}× · {duration(team.away.totalMs)}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-hairline p-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/60">Devices</h3>
            {team.devices.length === 0 ? (
              <p className="text-sm text-charcoal/60">No device recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-charcoal/60">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Device</th>
                      <th className="py-1 pr-3 font-medium">Browser</th>
                      <th className="py-1 pr-3 font-medium">IP (first → last)</th>
                      <th className="py-1 pr-3 font-medium">Logins</th>
                      <th className="py-1 pr-3 font-medium">First seen</th>
                      <th className="py-1 font-medium">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {team.devices.map((device) => (
                      <tr key={device.deviceId}>
                        <td className="py-1.5 pr-3 font-mono">
                          {device.kind === "MOBILE"
                            ? <Smartphone aria-label="Phone" className="mr-1 inline h-3.5 w-3.5 text-red-600" />
                            : <Laptop aria-label="Laptop" className="mr-1 inline h-3.5 w-3.5" />}
                          …{shortId(device.deviceId)}
                          {device.sharedWith.length > 0 && (
                            <span className="ml-1 text-red-600 dark:text-red-400">also {device.sharedWith.join(", ")}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">{device.browser}</td>
                        <td className="py-1.5 pr-3 font-mono">
                          {device.firstIp ?? "?"}{device.lastIp && device.lastIp !== device.firstIp ? ` → ${device.lastIp}` : ""}
                        </td>
                        <td className="py-1.5 pr-3 font-mono">{device.loginCount}</td>
                        <td className="py-1.5 pr-3 font-mono">{formatIST(device.firstSeenAt)}</td>
                        <td className="py-1.5 font-mono">{formatIST(device.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
              Flags {team.away.count > team.away.episodes.length && `(latest ${team.away.episodes.length} of ${team.away.count})`}
            </h3>
            {team.away.episodes.length === 0 ? (
              <p className="text-sm text-charcoal/60">Never left the page while playing.</p>
            ) : (
              <ol className="space-y-1 text-xs">
                {team.away.episodes.map((episode) => (
                  <li key={episode.id} className="flex flex-wrap gap-x-3 font-mono">
                    <span>{formatIST(episode.leftAt)}</span>
                    <span className="text-charcoal/60">{episode.questionNumber ? `Q${episode.questionNumber}` : "—"}</span>
                    <span className={episode.awayMs === null ? "text-red-600 dark:text-red-400" : ""}>
                      {isInstant(episode.reasons) ? "blocked" : episode.awayMs === null ? "no return recorded" : duration(episode.awayMs)}
                    </span>
                    <span className="font-sans text-charcoal/70">{episode.reasons.map((reason) => REASON_LABEL[reason]).join(" · ")}</span>
                    <span className="text-charcoal/50">…{shortId(episode.deviceId)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
