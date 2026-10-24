"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/AppLink";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";
import { withEvent } from "@/components/admin/algohunt/nav/navModel";
import { formatWaiting } from "@/components/admin/algohunt/overview/overviewModel";
import { usePoll } from "@/components/algohunt/usePoll";
import { formatIST } from "@/lib/algohunt/format";
import type { TeamStatus } from "@/lib/algohunt/types";
import type { AdminTeamRow } from "@/server/algohunt/admin/teams";
import {
  TEAM_STATUSES, TEAM_STATUS_CLASS, TEAM_STATUS_LABEL, filterWaiting, formatAgo, sortTeams,
  type SortDir, type SortKey,
} from "./teamsModel";

const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "college", label: "College" },
  { key: "status", label: "Status" },
  { key: "currentQuestion", label: "Current question" },
  { key: "questionsSolved", label: "Solved" },
  { key: "waiting", label: "Waiting for code" },
  { key: "lastActivityAt", label: "Last activity" },
  { key: "checkedInAt", label: "Checked in" },
  { key: "finishedAt", label: "Finished" },
];

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 font-mono text-xs transition ${
    active ? "border-bronze bg-bronze/15 text-chocolate" : "border-hairline text-charcoal/70 hover:text-chocolate"
  }`;

interface TeamsData {
  teams: AdminTeamRow[];
  serverNow: number;
}

export default function TeamsList({ eventSlug }: { eventSlug: string }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<TeamStatus | null>(null);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "code", dir: "asc" });
  const [checkingIn, setCheckingIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const params = new URLSearchParams({ event: eventSlug });
  if (debounced) params.set("q", debounced);
  if (status) params.set("status", status);
  const { data, error, online, refresh } = usePoll<TeamsData>(`/api/admin/algohunt/teams?${params}`, {
    intervalMs: 10_000, jitterMs: 1000,
  });

  const now = data?.serverNow ?? 0;
  const rows = useMemo(
    () => (data ? sortTeams(filterWaiting(data.teams, waitingOnly), sort.key, sort.dir, now) : []),
    [data, waitingOnly, sort, now],
  );

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="team-search">Search teams</label>
        <input
          id="team-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, name or college"
          className="mecha-input w-full max-w-xs"
        />
        <button
          type="button"
          onClick={() => { setNotice(null); setCheckingIn(true); }}
          className="mecha-btn mecha-btn--ghost mecha-btn--sm ml-auto"
        >
          Check in all registered teams
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button type="button" onClick={() => setStatus(null)} aria-pressed={status === null} className={chip(status === null)}>
          All
        </button>
        {TEAM_STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(status === s ? null : s)} aria-pressed={status === s} className={chip(status === s)}>
            {TEAM_STATUS_LABEL[s]}
          </button>
        ))}
        <button type="button" onClick={() => setWaitingOnly((v) => !v)} aria-pressed={waitingOnly} className={chip(waitingOnly)}>
          Waiting for a code
        </button>
      </div>

      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {(error || !online) && (
        <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          {data ? (online ? error : "Offline. Showing the last list we got; retrying.") : error}
        </p>
      )}

      {!data ? (
        !error && <p role="status" className="text-sm text-charcoal/70">Loading teams…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-charcoal/70">No teams match.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline bg-panel">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-wider text-bronze">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={sort.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className="px-3 py-2 font-medium"
                  >
                    <button type="button" onClick={() => toggleSort(col.key)} className="uppercase tracking-wider hover:text-chocolate">
                      {col.label}{sort.key === col.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((team) => {
                const href = withEvent(`/admin/algohunt/teams/${team.id}`, eventSlug);
                return (
                  <tr key={team.id} className="hover:bg-hairline/30">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      <Link href={href} className="text-bronze hover:underline">{team.code}</Link>
                    </td>
                    <td className="min-w-[10rem] px-3 py-2 font-medium text-chocolate">
                      <Link href={href} className="hover:underline">{team.name}</Link>
                    </td>
                    <td className="min-w-[8rem] px-3 py-2 text-charcoal/70">{team.college ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${TEAM_STATUS_CLASS[team.status]}`}>
                        {TEAM_STATUS_LABEL[team.status] ?? team.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{team.currentQuestion === null ? "—" : `Q${team.currentQuestion}`}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{team.questionsSolved}/{team.totalStages}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {team.waitingForCode && team.waitingSince !== null ? (
                        <span className="whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-xs text-amber-700 dark:text-amber-300">
                          waiting {formatWaiting(now - team.waitingSince)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-charcoal/70">{team.lastActivityAt === null ? "—" : formatAgo(team.lastActivityAt, now)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-charcoal/70">{team.checkedInAt === null ? "—" : formatIST(team.checkedInAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-charcoal/70">{team.finishedAt === null ? "—" : formatIST(team.finishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmAction
        open={checkingIn}
        title="Check in all registered teams?"
        consequences="Every team that is still Registered is checked in now and can open its first question when the event starts. Teams already checked in are left alone."
        confirmPhrase={eventSlug}
        confirmLabel="Check in all"
        onConfirm={async ({ confirm }) => {
          const result = await adminFetch<{ count: number }>(
            "POST", `/api/admin/algohunt/teams/checkin-all?event=${encodeURIComponent(eventSlug)}`, { confirm },
          );
          setNotice(`Checked in ${result.count} ${result.count === 1 ? "team" : "teams"}.`);
          refresh();
        }}
        onClose={() => setCheckingIn(false)}
      />
    </div>
  );
}
