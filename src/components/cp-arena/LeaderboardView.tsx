"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/components/auth/useUser";
import LeaderboardTable, {
  type LeaderRow,
  type LeaderScope,
} from "./LeaderboardTable";

const TABS: { scope: LeaderScope; label: string }[] = [
  { scope: "today", label: "Today" },
  { scope: "month", label: "This Month" },
  { scope: "all", label: "All-Time" },
];

export default function LeaderboardView() {
  const user = useUser();
  const [scope, setScope] = useState<LeaderScope>("today");
  const [cache, setCache] = useState<Partial<Record<LeaderScope, LeaderRow[]>>>({});
  const fetched = useRef<Set<LeaderScope>>(new Set());

  useEffect(() => {
    if (fetched.current.has(scope)) return;
    let alive = true;
    fetch(`/api/leaderboard?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        fetched.current.add(scope);
        setCache((c) => ({ ...c, [scope]: d.rows ?? [] }));
      })
      .catch(() => {
        if (!alive) return;
        fetched.current.add(scope);
        setCache((c) => ({ ...c, [scope]: [] }));
      });
    return () => {
      alive = false;
    };
  }, [scope]);

  const rows = cache[scope];

  return (
    <div>
      <div className="inline-flex rounded-full border border-hairline bg-panel p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.scope}
            type="button"
            onClick={() => setScope(t.scope)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              scope === t.scope
                ? "bg-bronze/15 font-semibold text-chocolate"
                : "text-charcoal/60 hover:text-chocolate"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-panel shadow-sm">
        {rows === undefined ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal/50">
            Loading…
          </p>
        ) : (
          <LeaderboardTable
            rows={rows}
            scope={scope}
            currentUsername={user?.username}
          />
        )}
      </div>
    </div>
  );
}
