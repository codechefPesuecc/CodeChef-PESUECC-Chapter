"use client";

import Link from "@/components/AppLink";
import type { SubmitResult } from "@/lib/algohunt/types";
import { COPY } from "@/lib/algohunt/copy";

type VerdictKind = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "ERR" | "error";

interface VerdictPanelProps {
  result: SubmitResult | { ok?: false; code?: string; message?: string; submission?: null };
  stageNumber: number;
  isFinal: boolean;
  onRetry?: () => void;
}

export default function VerdictPanel({ result, stageNumber, isFinal: _isFinal, onRetry }: VerdictPanelProps) {
  // Network/connection error (submission is null)
  if (!result || (result as { submission?: null }).submission === null) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/8 p-4">
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          {(result as { message?: string }).message ?? "Connection problem."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 mecha-btn text-sm"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ok: false from the server
  const asError = result as { ok?: false; code?: string; message?: string };
  if (asError.ok === false) {
    if (asError.code === "EVENT_PAUSED") {
      return (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/8 px-4 py-3">
          <p className="font-semibold text-amber-700 dark:text-amber-400">{COPY.paused}</p>
        </div>
      );
    }
    if (asError.code === "ALREADY_SOLVED") {
      return (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <p className="font-semibold text-green-700 dark:text-green-400">Question already solved!</p>
          <p className="mt-1 text-sm text-green-600 dark:text-green-300/80">{COPY.accepted}</p>
          <Link href="/algohunt/code" className="mecha-btn mecha-btn--primary mt-2 inline-block text-sm">
            Enter a QR code →
          </Link>
        </div>
      );
    }
    if (asError.code === "JUDGE_UNAVAILABLE") {
      return (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3">
          <p className="font-semibold text-red-600 dark:text-red-400">{COPY.errors.JUDGE_UNAVAILABLE}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-2 mecha-btn text-sm">
              Retry
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3">
        <p className="text-sm text-red-600 dark:text-red-400">
          {asError.message ?? COPY.errors.INTERNAL}
        </p>
      </div>
    );
  }

  // Normal SubmitResult
  const { submission, stage, message } = result as SubmitResult;
  const verdict = submission?.verdict as VerdictKind | null | undefined;

  // AC — not final (needs code)
  if (verdict === "AC" && stage.needsCode) {
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <span className="font-bold text-green-700 dark:text-green-400">
            Question {stageNumber} solved!
          </span>
        </div>
        <p className="mt-2 text-sm text-green-600 dark:text-green-300/80">{COPY.accepted}</p>
        <Link href="/algohunt/code" className="mecha-btn mecha-btn--primary mt-3 inline-block">
          Enter a QR code →
        </Link>
      </div>
    );
  }

  // AC — final question → finished
  if (verdict === "AC" && stage.finished) {
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-center">
        <div className="text-4xl">🎉</div>
        <p className="mt-2 font-bold text-green-700 dark:text-green-400">AlgoHunt 2.0 Complete!</p>
        <p className="mt-1 text-sm text-green-600 dark:text-green-300/80">{COPY.finished}</p>
        <Link href="/algohunt/leaderboard" className="mecha-btn mecha-btn--primary mt-3 inline-block">
          View Leaderboard
        </Link>
      </div>
    );
  }

  // WA / TLE / MLE
  if (verdict === "WA" || verdict === "TLE" || verdict === "MLE") {
    const color = verdict === "WA" ? "red" : "amber";
    const colorClasses = {
      red: "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-400",
      amber: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-400",
    }[color];
    return (
      <div className={`rounded-lg border p-4 ${colorClasses}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold">{verdict}</span>
          <VerdictChip verdict={verdict} />
        </div>
        <p className="mt-1 text-sm">{message}</p>
        {submission.passed != null && submission.total != null && (
          <p className="mt-1 text-xs opacity-70">
            {submission.passed}/{submission.total} tests passed
          </p>
        )}
      </div>
    );
  }

  // RE / CE
  if (verdict === "RE" || verdict === "CE") {
    return (
      <div className="rounded-lg border border-gray-400/30 bg-gray-400/10 p-4">
        <div className="flex items-center gap-2 text-charcoal/70 dark:text-cream/70">
          <VerdictChip verdict={verdict} />
          <span className="font-semibold">{message}</span>
        </div>
        {submission.detail && (
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-xs text-charcoal/80 dark:bg-white/5 dark:text-cream/80">
            {submission.detail}
          </pre>
        )}
      </div>
    );
  }

  // ERR / system error
  return (
    <div className="rounded-lg border border-gray-400/30 bg-gray-400/10 px-4 py-3">
      <p className="text-sm text-charcoal/60 dark:text-cream/60">
        System error — your progress has not been changed.
      </p>
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: VerdictKind }) {
  const classes: Record<VerdictKind, string> = {
    AC: "bg-green-500/15 text-green-700 dark:text-green-400",
    WA: "bg-red-500/15 text-red-700 dark:text-red-400",
    TLE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    MLE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    RE: "bg-gray-500/15 text-charcoal/70 dark:text-cream/70",
    CE: "bg-gray-500/15 text-charcoal/70 dark:text-cream/70",
    ERR: "bg-gray-500/15 text-charcoal/50 dark:text-cream/50",
    error: "bg-gray-500/15 text-charcoal/50 dark:text-cream/50",
  };
  const label: Record<VerdictKind, string> = {
    AC: "Accepted", WA: "Wrong Answer", TLE: "Time Limit", MLE: "Memory Limit",
    RE: "Runtime Error", CE: "Compile Error", ERR: "System Error", error: "Error",
  };
  return (
    <span className={`mecha-chip text-xs ${classes[verdict] ?? classes.ERR}`}>
      {label[verdict] ?? verdict}
    </span>
  );
}
