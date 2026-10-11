"use client";

import { useEffect, useState } from "react";
import { formatIST } from "@/lib/algohunt/format";
import type { SubmissionView } from "@/lib/algohunt/types";

interface SubmissionWithCode extends SubmissionView {
  code?: string;
}

type VerdictLabel = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "ERR";

const VERDICT_CHIP: Record<string, string> = {
  AC: "bg-green-500/15 text-green-700 dark:text-green-400",
  WA: "bg-red-500/15 text-red-700 dark:text-red-400",
  TLE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  MLE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  RE: "bg-gray-500/15 text-charcoal/70 dark:text-cream/70",
  CE: "bg-gray-500/15 text-charcoal/70 dark:text-cream/70",
  ERR: "bg-gray-500/15 text-charcoal/50 dark:text-cream/50",
};
const VERDICT_LABEL: Record<string, string> = {
  AC: "Accepted", WA: "Wrong Answer", TLE: "Time Limit", MLE: "Memory Limit",
  RE: "Runtime Error", CE: "Compile Error", ERR: "System Error",
};

interface SubmissionListProps {
  stageNumber: number;
  teamCode: string;
  /** Increment to trigger a re-fetch (after a submit). */
  refresh?: number;
}

export default function SubmissionList({ stageNumber, teamCode: _teamCode, refresh = 0 }: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/algohunt/submissions")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setSubmissions(data.submissions ?? []);
        } else {
          setError(data.error ?? "Failed to load submissions.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load submissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refresh]);

  if (loading) {
    return (
      <p className="text-xs text-charcoal/40 dark:text-cream/40">Loading submissions…</p>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  if (submissions.length === 0) {
    return (
      <p className="text-xs text-charcoal/40 dark:text-cream/40">
        No submissions for Question {stageNumber} yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/50 dark:text-cream/50">
        Submissions — Q{stageNumber}
      </p>
      {submissions.map((sub) => {
        const isExpanded = expanded === sub.id;
        const verdict = sub.verdict as VerdictLabel | null;
        return (
          <div key={sub.id} className="rounded-lg border border-hairline">
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : sub.id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              aria-expanded={isExpanded}
            >
              {verdict ? (
                <span className={`mecha-chip text-xs ${VERDICT_CHIP[verdict] ?? VERDICT_CHIP.ERR}`}>
                  {VERDICT_LABEL[verdict] ?? verdict}
                </span>
              ) : (
                <span className="mecha-chip text-xs bg-charcoal/10 text-charcoal/50 dark:bg-cream/10 dark:text-cream/50">
                  {sub.status}
                </span>
              )}
              <span className="text-xs text-charcoal/60 dark:text-cream/60">
                {sub.language}
              </span>
              {sub.passed != null && sub.total != null && verdict !== "AC" && (
                <span className="text-xs text-charcoal/40 dark:text-cream/40">
                  {sub.passed}/{sub.total}
                </span>
              )}
              <span className="ml-auto text-xs text-charcoal/40 dark:text-cream/40">
                {formatIST(sub.createdAt)}
              </span>
              <span className="text-xs text-charcoal/30 dark:text-cream/30">
                {isExpanded ? "▲" : "▼"}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-hairline px-3 py-2">
                {sub.detail && (
                  <pre className="mb-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-xs text-charcoal/80 dark:bg-white/5 dark:text-cream/80">
                    {sub.detail}
                  </pre>
                )}
                {sub.code && (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-xs text-charcoal/70 dark:bg-white/5 dark:text-cream/70">
                    {sub.code}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
