"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, Loader2, RefreshCw, FileText } from "lucide-react";
import { formatIST } from "@/lib/algohunt/format";
import type { AhAuditLog } from "@/server/db/schema";
import { usePoll } from "@/components/algohunt/usePoll";

export type AuditItem = AhAuditLog & {
  teamName: string | null;
  actorName: string | null;
  text: string;
};

interface AuditResponse {
  ok: boolean;
  rows: AuditItem[];
  nextCursor: number | null;
}

const ACTION_PREFIXES = [
  { label: "All Actions", value: "ALL" },
  { label: "code.* (Redemption & Pool)", value: "code." },
  { label: "stage.* (Progression & Solve)", value: "stage." },
  { label: "team.* (Checkin & Status)", value: "team." },
  { label: "event.* (Event State)", value: "event." },
  { label: "override.* (Admin Overrides)", value: "override." },
  { label: "volunteer.* (Staffing)", value: "volunteer." },
];

export default function AuditAdmin({ eventSlug }: { eventSlug: string }) {
  const [teamFilter, setTeamFilter] = useState("");
  const [actionPrefix, setActionPrefix] = useState<string>("ALL");
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const [appendedRows, setAppendedRows] = useState<AuditItem[]>([]);
  const [cursorOverride, setCursorOverride] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  function handleFilterReset() {
    setAppendedRows([]);
    setCursorOverride(null);
  }

  function toggleExpand(id: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const url = useMemo(() => {
    const params = new URLSearchParams({ event: eventSlug });
    if (teamFilter.trim()) params.set("team", teamFilter.trim());
    if (actionPrefix !== "ALL") params.set("action", actionPrefix);
    return `/api/admin/algohunt/audit?${params.toString()}`;
  }, [eventSlug, teamFilter, actionPrefix]);

  const { data, loading, refresh } = usePoll<AuditResponse>(url, {
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
        before: String(activeCursor),
      });
      if (teamFilter.trim()) params.set("team", teamFilter.trim());
      if (actionPrefix !== "ALL") params.set("action", actionPrefix);

      const res = await fetch(`/api/admin/algohunt/audit?${params.toString()}`);
      const json = await res.json() as AuditResponse;
      if (json.ok) {
        setAppendedRows((prev) => [...prev, ...json.rows]);
        setCursorOverride(json.nextCursor);
      }
    } catch (e) {
      console.error("Failed to load more audit logs", e);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="lc-panel p-4 grid gap-3 sm:grid-cols-3 items-end">
        <div>
          <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
            Filter by Team Code
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-charcoal/50 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Team code..."
              className="mecha-input text-xs pl-8 w-full font-mono uppercase"
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value.toUpperCase());
                handleFilterReset();
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-charcoal/70 mb-1">
            Action Category
          </label>
          <select
            className="mecha-input text-xs w-full"
            value={actionPrefix}
            onChange={(e) => {
              setActionPrefix(e.target.value);
              handleFilterReset();
            }}
          >
            {ACTION_PREFIXES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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

      {/* Logs Table */}
      <div className="lc-panel p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-chocolate flex items-center gap-2">
          <FileText className="w-5 h-5 text-bronze" /> Immutable Audit Log
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline font-mono uppercase text-[11px] text-charcoal/50">
                <th className="pb-2">Time (IST)</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Activity Description</th>
                <th className="pb-2 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center font-mono text-charcoal/60">
                    {loading ? "Loading audit logs..." : "No audit entries recorded."}
                  </td>
                </tr>
              ) : (
                allRows.map((row) => {
                  const isExpanded = expandedRowIds.has(row.id);
                  let formattedMeta = row.metadata;
                  try {
                    formattedMeta = JSON.stringify(JSON.parse(row.metadata), null, 2);
                  } catch {
                    // keep raw
                  }

                  return (
                    <tr key={row.id} className="hover:bg-hairline/20 align-top">
                      <td className="py-2.5 font-mono text-charcoal/70 whitespace-nowrap">
                        {formatIST(row.createdAt)}
                      </td>
                      <td className="py-2.5 font-medium text-chocolate whitespace-nowrap">
                        <span className="block">{row.actorName ?? row.actorId ?? "System"}</span>
                        <span className="font-mono text-[10px] text-charcoal/50 uppercase">
                          {row.actorType}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-bronze whitespace-nowrap">
                        {row.action}
                      </td>
                      <td className="py-2.5 text-charcoal/90 leading-relaxed">
                        <span>{row.text}</span>
                        {isExpanded && (
                          <div className="mt-2 p-2.5 rounded bg-black/5 dark:bg-black/40 border border-hairline">
                            <span className="font-mono text-[10px] uppercase text-charcoal/60 block mb-1">
                              Metadata JSON:
                            </span>
                            <pre className="font-mono text-[11px] overflow-x-auto text-charcoal/80">
                              {formattedMeta}
                            </pre>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.id)}
                          className="p-1 rounded text-charcoal/60 hover:text-chocolate hover:bg-hairline/40 transition inline-flex items-center gap-1 text-[11px] font-mono"
                          title="Toggle raw metadata"
                        >
                          {isExpanded ? (
                            <>
                              Hide <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              Raw <ChevronRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
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
              Load Older Logs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
