"use client";

import { Trophy } from "lucide-react";
import { formatIST } from "@/lib/algohunt/format";
import type { LeaderboardRow, RankingMode } from "@/lib/algohunt/types";
import { usePoll } from "../usePoll";
import { useParticipantState } from "./ParticipantStateProvider";

interface LeaderboardResponse {
  visible: boolean;
  mode: RankingMode;
  rows: LeaderboardRow[];
  updatedAt: number;
}

const RANKED_BY: Record<RankingMode, string> = {
  SOLVED_THEN_TIME: "Ranked by: finish time, then questions solved, then who solved them first.",
  POINTS_THEN_TIME: "Ranked by: points, then who solved them first.",
};

/** Server-ranked leaderboard. Its own slow poll; the team state still comes from the shared provider. */
export default function LeaderboardBoard() {
  const { state } = useParticipantState();
  const { data, error } = usePoll<LeaderboardResponse>("/api/algohunt/leaderboard", { intervalMs: 20000, jitterMs: 3000 });

  return (
    <section className="space-y-3" aria-labelledby="ah-leaderboard">
      <h1 id="ah-leaderboard" className="flex items-center gap-2 font-display text-2xl font-bold">
        <Trophy aria-hidden className="h-6 w-6 text-bronze" />
        Leaderboard
      </h1>

      {!data ? (
        <p className="lc-panel p-4 text-sm text-charcoal/70">{error ?? "Loading the leaderboard…"}</p>
      ) : !data.visible ? (
        <p className="lc-panel p-4 text-sm text-charcoal/70">The leaderboard is hidden right now.</p>
      ) : data.rows.length === 0 ? (
        <p className="lc-panel p-4 text-sm text-charcoal/70">No teams yet.</p>
      ) : (
        <div className="lc-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/50">
                <th scope="col" className="px-3 py-2 font-medium">Rank</th>
                <th scope="col" className="px-3 py-2 font-medium">Team</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">College</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Solved</th>
                {data.mode === "POINTS_THEN_TIME" && <th scope="col" className="px-3 py-2 text-right font-medium">Points</th>}
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr
                  key={`${row.rank}-${row.teamName}-${i}`}
                  aria-current={row.isYou ? "true" : undefined}
                  className={`border-b border-hairline last:border-0 ${row.isYou ? "bg-bronze/15 font-semibold" : ""}`}
                >
                  <td className="px-3 py-2 font-mono tabular-nums">{row.rank}</td>
                  <td className="px-3 py-2">
                    <span className="break-words">{row.teamName}</span>
                    {row.isYou && <span className="mecha-chip ml-2 bg-bronze/20 text-bronze">You</span>}
                    {row.college && <span className="block text-xs font-normal text-charcoal/60 sm:hidden">{row.college}</span>}
                  </td>
                  <td className="hidden px-3 py-2 text-charcoal/70 sm:table-cell">{row.college ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.questionsSolved}/{state.totalStages}
                  </td>
                  {data.mode === "POINTS_THEN_TIME" && (
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{row.points}</td>
                  )}
                  <td className="px-3 py-2 text-xs">
                    {row.finished && row.finishedAt !== null ? `Finished ${formatIST(row.finishedAt)}` : "In progress"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div className="space-y-1 text-xs text-charcoal/60">
          {data.visible && <p>{RANKED_BY[data.mode]}</p>}
          <p>Updated {formatIST(data.updatedAt)}</p>
        </div>
      )}
    </section>
  );
}
