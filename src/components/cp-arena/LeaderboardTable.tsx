"use client";

import { formatClock } from "./mockData";

export type LeaderScope = "today" | "month" | "all";

export interface LeaderRow {
  rank: number | null;
  username: string;
  points: number;
  flagged: boolean;
  solved?: number;
  language?: string;
  timeSeconds?: number | null;
}

export default function LeaderboardTable({
  rows,
  scope,
  currentUsername,
}: {
  rows: LeaderRow[];
  scope: LeaderScope;
  currentUsername?: string | null;
}) {
  const isToday = scope === "today";

  if (rows.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-charcoal/50">
        No solvers yet
        {isToday ? " — be the first to crack today's problem." : "."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
            <th className="px-6 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">Solver</th>
            {isToday ? (
              <>
                <th className="px-3 py-3 font-medium">Lang</th>
                <th className="px-3 py-3 font-medium">Time</th>
              </>
            ) : (
              <th className="px-3 py-3 font-medium">Solved</th>
            )}
            <th className="px-6 py-3 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const you = !!currentUsername && r.username === currentUsername;
            return (
              <tr
                key={r.username}
                className={`border-t border-hairline ${
                  you
                    ? "bg-bronze/10"
                    : r.flagged
                      ? "bg-red-500/10"
                      : i % 2 === 1
                        ? "bg-cream/40 dark:bg-white/[0.02]"
                        : ""
                }`}
              >
                <td className="px-6 py-3">
                  <RankBadge rank={r.rank} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                        you ? "bg-bronze text-white" : "bg-bronze/15 text-bronze"
                      }`}
                    >
                      {r.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex items-center gap-2 font-semibold text-chocolate">
                      @{r.username}
                      {r.flagged && (
                        <span className="mecha-chip bg-red-500/15 text-red-600 dark:text-red-400">
                          Flagged
                        </span>
                      )}
                      {you && (
                        <span className="text-[10px] font-medium uppercase text-bronze">
                          you
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                {isToday ? (
                  <>
                    <td className="px-3 py-3 text-charcoal/70">{r.language}</td>
                    <td className="px-3 py-3 font-mono text-charcoal/70">
                      {r.timeSeconds != null ? formatClock(r.timeSeconds) : "—"}
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-3 text-charcoal/70">{r.solved}</td>
                )}
                <td className="px-6 py-3 text-right font-display font-bold text-brown">
                  {r.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) {
    return <span className="font-mono text-sm text-red-500">—</span>;
  }
  const styles: Record<number, string> = {
    1: "bg-[#d9a441]/20 text-[#b7842a]",
    2: "bg-[#b9b4ad]/25 text-[#7d7a76]",
    3: "bg-[#c08457]/20 text-[#a5623a]",
  };
  if (rank <= 3) {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${styles[rank]}`}
      >
        {rank}
      </span>
    );
  }
  return <span className="font-mono text-sm text-charcoal/50">{rank}</span>;
}
