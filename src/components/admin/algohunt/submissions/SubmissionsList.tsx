"use client";

import { useState, useMemo } from "react";
import { Search, Loader2, Code2, RefreshCw } from "lucide-react";
import AppLink from "@/components/AppLink";
import { formatIST } from "@/lib/algohunt/format";
import type { AhVerdict, SubmissionStatus } from "@/lib/algohunt/types";
import { usePoll } from "@/components/algohunt/usePoll";

export interface SubmissionRow {
  id: string;
  createdAt: number;
  teamCode: string;
  teamName: string;
  stageNumber: number;
  language: string;
  status: SubmissionStatus;
  verdict: AhVerdict | null;
  passed: number | null;
  total: number | null;
}

interface SubmissionsResponse {
  ok: boolean;
  rows: SubmissionRow[];
  nextCursor: number | null;
}

const VERDICT_CHIPS: Record<string, string> = {
  AC: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  WA: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  TLE: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  MLE: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  RTE: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  CE: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  RUNNING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 animate-pulse",
  FAILED: "bg-red-600/15 text-red-800 dark:text-red-200 border-red-500/40",
};

export default function SubmissionsList({ eventSlug }: { eventSlug: string }) {
  const [teamFilter, setTeamFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");

  const [appendedRows, setAppendedRows] = useState<SubmissionRow[]>([]);
  const [cursorOverride, setCursorOverride] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  function handleFilterChange() {
    setAppendedRows([]);
    setCursorOverride(null);
  }

  const url = useMemo(() => {
    const params = new URLSearchParams({ event: eventSlug });
    if (teamFilter.trim()) params.set("team", teamFilter.trim());
    if (stageFilter !== "ALL") params.set("stage", stageFilter);
    if (verdictFilter !== "ALL") params.set("verdict", verdictFilter);
    return `/api/admin/algohunt/submissions?${params.toString()}`;
  }, [eventSlug, teamFilter, stageFilter, verdictFilter]);

  const { data, loading, refresh } = usePoll<SubmissionsResponse>(url, {
    intervalMs: 15000,
  });

  const allRows = useMemo(() => {
    const base = data?.rows ?? [];
    if (appendedRows.length === 0) return base;
    const existingIds = new Set(base.map((r) => r.id));
    return [...base, ...appendedRows.filter((r) => !existingIds.has(r.id))];
  }, [data?.rows, appendedRows]);

  const activeCursor = cursorOverride ?? (data?.nextCursor ?? null);

  async function handleLoadMore() {
    if (!activeCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        event: eventSlug,
        cursor: String(activeCursor),
      });
      if (teamFilter.trim()) params.set("team", teamFilter.trim());
      if (stageFilter !== "ALL") params.set("stage", stageFilter);
      if (verdictFilter !== "ALL") params.set("verdict", verdictFilter);

      const res = await fetch(`/api/admin/algohunt/submissions?${params.toString()}`);
      const json = await res.json() as SubmissionsResponse;
      if (json.ok) {
        setAppendedRows((prev) => [...prev, ...json.rows]);
        setCursorOverride(json.nextCursor);
      }
    } catch (e) {
      console.error("Failed to load more submissions", e);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="lc-panel p-4 grid gap-3 sm:grid-cols-4 items-end">
        <div>
          <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
            Team Code
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-charcoal/50 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter team..."
              className="mecha-input text-xs pl-8 w-full font-mono uppercase"
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value.toUpperCase());
                handleFilterChange();
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
            Question
          </label>
          <select
            className="mecha-input text-xs w-full"
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              handleFilterChange();
            }}
          >
            <option value="ALL">All Questions</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={String(n)}>
                Question {n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
            Verdict
          </label>
          <select
            className="mecha-input text-xs w-full"
            value={verdictFilter}
            onChange={(e) => {
              setVerdictFilter(e.target.value);
              handleFilterChange();
            }}
          >
            <option value="ALL">All Verdicts</option>
            <option value="AC">Accepted (AC)</option>
            <option value="WA">Wrong Answer (WA)</option>
            <option value="TLE">Time Limit (TLE)</option>
            <option value="MLE">Memory Limit (MLE)</option>
            <option value="RTE">Runtime Error (RTE)</option>
            <option value="CE">Compile Error (CE)</option>
          </select>
        </div>

        <div className="flex justify-end pb-0.5">
          <button
            type="button"
            onClick={() => refresh()}
            className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="lc-panel p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-chocolate">Submissions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline font-mono uppercase text-[11px] text-charcoal/50">
                <th className="pb-2">Time (IST)</th>
                <th className="pb-2">Team</th>
                <th className="pb-2">Question</th>
                <th className="pb-2">Language</th>
                <th className="pb-2">Verdict</th>
                <th className="pb-2">Tests Passed</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center font-mono text-charcoal/60">
                    {loading ? "Loading submissions..." : "No submissions found."}
                  </td>
                </tr>
              ) : (
                allRows.map((row) => {
                  const verdictTag = row.verdict ?? (row.status === "RUNNING" ? "RUNNING" : "PENDING");
                  return (
                    <tr key={row.id} className="hover:bg-hairline/20">
                      <td className="py-2.5 font-mono text-charcoal/70">
                        {formatIST(row.createdAt)}
                      </td>
                      <td className="py-2.5 font-medium text-chocolate">
                        {row.teamName}{" "}
                        <span className="font-mono text-charcoal/60">({row.teamCode})</span>
                      </td>
                      <td className="py-2.5 font-mono">Q {row.stageNumber}</td>
                      <td className="py-2.5 font-mono uppercase text-charcoal/70">{row.language}</td>
                      <td className="py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                            VERDICT_CHIPS[verdictTag] ?? "bg-panel text-charcoal"
                          }`}
                        >
                          {verdictTag}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-charcoal/80">
                        {row.passed !== null && row.total !== null
                          ? `${row.passed} / ${row.total}`
                          : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <AppLink
                          href={`/admin/algohunt/submissions/${row.id}`}
                          className="mecha-btn mecha-btn--ghost text-[11px] px-2.5 py-1 inline-flex items-center gap-1"
                        >
                          <Code2 className="w-3 h-3 text-bronze" /> View Code
                        </AppLink>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {activeCursor && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-2"
            >
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Load More Submissions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
