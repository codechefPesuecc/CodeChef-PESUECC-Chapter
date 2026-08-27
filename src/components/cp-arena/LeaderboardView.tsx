"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/components/auth/useUser";
import LeaderboardTable, {
  type LeaderRow,
  type LeaderScope,
} from "./LeaderboardTable";
import MechaPanel from "./MechaPanel";

const TABS: { scope: LeaderScope; label: string }[] = [
  { scope: "today", label: "Today" },
  { scope: "month", label: "This Month" },
  { scope: "all", label: "All-Time" },
];

type SortKey = "points" | "solver" | "time" | "solved";

export default function LeaderboardView() {
  const user = useUser();
  const [scope, setScope] = useState<LeaderScope>("today");
  const [cache, setCache] = useState<
    Partial<Record<LeaderScope, LeaderRow[]>>
  >({});
  const [errors, setErrors] = useState<
    Partial<Record<LeaderScope, boolean>>
  >({});
  const fetched = useRef<Set<LeaderScope>>(new Set());

  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [ascending, setAscending] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("all");

  useEffect(() => {
    if (fetched.current.has(scope)) return;

    let alive = true;

    fetch(`/api/leaderboard?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;

        fetched.current.add(scope);
        setErrors((e) => ({ ...e, [scope]: false }));
        setCache((c) => ({ ...c, [scope]: d.rows ?? [] }));
      })
      .catch(() => {
        if (!alive) return;

        setErrors((e) => ({ ...e, [scope]: true }));
      });

    return () => {
      alive = false;
    };
  }, [scope]);

  const rows = cache[scope];

  const activeLabel =
    TABS.find((t) => t.scope === scope)?.label ?? "Standings";

  const languages = useMemo(() => {
    if (!rows) return [];

    return Array.from(
      new Set(
        rows
          .map((row) => row.language)
          .filter((language): language is string => Boolean(language)),
      ),
    ).sort();
  }, [rows]);

  const processedRows = useMemo(() => {
    if (!rows) return undefined;

    let result = [...rows];

    if (scope === "today" && languageFilter !== "all") {
      result = result.filter((row) => row.language === languageFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;

      if (sortKey === "points") {
        comparison = b.points - a.points;
      } else if (sortKey === "solver") {
        comparison = a.display.localeCompare(b.display);
      } else if (sortKey === "time") {
        comparison =
          (a.timeSeconds ?? Number.MAX_SAFE_INTEGER) -
          (b.timeSeconds ?? Number.MAX_SAFE_INTEGER);
      } else if (sortKey === "solved") {
        comparison = (b.solved ?? 0) - (a.solved ?? 0);
      }

      return ascending ? -comparison : comparison;
    });

    return result;
  }, [rows, scope, sortKey, ascending, languageFilter]);

  function changeScope(nextScope: LeaderScope) {
    setScope(nextScope);
    setSortKey("points");
    setAscending(false);
    setLanguageFilter("all");
  }

  function changeSort(nextSort: SortKey) {
    if (sortKey === nextSort) {
      setAscending((value) => !value);
    } else {
      setSortKey(nextSort);
      setAscending(false);
    }
  }

  return (
    <div>
      <div className="mecha-tabs">
        {TABS.map((t) => (
          <button
            key={t.scope}
            type="button"
            onClick={() => changeScope(t.scope)}
            className={`mecha-tab ${
              scope === t.scope ? "mecha-tab--active" : ""
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows !== undefined && !errors[scope] && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/50 dark:text-white/50">
            Sort
          </label>

          <select
            value={sortKey}
            onChange={(e) => changeSort(e.target.value as SortKey)}
            className="rounded border border-hairline bg-cream px-3 py-2 text-sm text-chocolate dark:bg-white/5 dark:text-white dark:border-white/10"
          >
            <option value="points">Points</option>
            <option value="solver">Solver</option>

            {scope === "today" ? (
              <option value="time">Time</option>
            ) : (
              <option value="solved">Solved</option>
            )}
          </select>

          <button
            type="button"
            onClick={() => setAscending((value) => !value)}
            className="mecha-tab"
          >
            {ascending ? "Ascending ↑" : "Descending ↓"}
          </button>

          {scope === "today" && languages.length > 0 && (
            <>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/50 dark:text-white/50">
                Language
              </label>

              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="rounded border border-hairline bg-cream px-3 py-2 text-sm text-chocolate dark:bg-white/5 dark:text-white dark:border-white/10"
              >
                <option value="all">All languages</option>

                {languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      <MechaPanel className="mt-4" label={activeLabel} ticks>
        {errors[scope] ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-charcoal/50 dark:text-white/50">
              Failed to load standings.
            </p>

            <button
              onClick={() => {
                fetched.current.delete(scope);
                setErrors((e) => ({ ...e, [scope]: false }));
                setScope(scope);
              }}
              className="mt-3 text-xs font-semibold text-bronze hover:underline"
            >
              Retry
            </button>
          </div>
        ) : processedRows === undefined ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal/50 dark:text-white/50">
            Loading…
          </p>
        ) : (
          <LeaderboardTable
            rows={processedRows}
            scope={scope}
            currentIdentity={user ? user.srn ?? user.prn : undefined}
          />
        )}
      </MechaPanel>
    </div>
  );
}