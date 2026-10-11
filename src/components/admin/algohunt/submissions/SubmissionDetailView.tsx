"use client";

import { useState } from "react";
import { Copy, Check, ArrowLeft, Terminal, AlertTriangle } from "lucide-react";
import AppLink from "@/components/AppLink";
import { formatIST } from "@/lib/algohunt/format";
import type { AhSubmission } from "@/server/db/schema";

export type SubmissionDetail = AhSubmission & {
  teamCode: string;
  teamName: string;
  stageNumber: number;
};

export default function SubmissionDetailView({
  submission,
}: {
  submission: SubmissionDetail;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(submission.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AppLink
          href="/admin/algohunt/submissions"
          className="mecha-btn mecha-btn--ghost mecha-btn--sm inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Submissions
        </AppLink>
        <span className="font-mono text-xs text-charcoal/60">
          ID: {submission.id}
        </span>
      </div>

      {/* Overview Card */}
      <div className="lc-panel p-5 grid gap-4 sm:grid-cols-4">
        <div>
          <span className="block font-mono text-[10px] uppercase text-charcoal/60">Team</span>
          <p className="mt-0.5 font-display font-bold text-base text-chocolate">
            {submission.teamName}
          </p>
          <p className="font-mono text-xs text-charcoal/70">{submission.teamCode}</p>
        </div>

        <div>
          <span className="block font-mono text-[10px] uppercase text-charcoal/60">Question</span>
          <p className="mt-0.5 font-display font-bold text-base text-chocolate">
            Question {submission.stageNumber}
          </p>
          <p className="font-mono text-xs text-charcoal/70 uppercase">Lang: {submission.language}</p>
        </div>

        <div>
          <span className="block font-mono text-[10px] uppercase text-charcoal/60">Verdict</span>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`mecha-chip text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                submission.verdict === "AC"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/15 text-red-700 dark:text-red-300"
              }`}
            >
              {submission.verdict ?? submission.status}
            </span>
            <span className="text-xs font-mono text-charcoal/70">
              {submission.passed !== null && submission.total !== null
                ? `${submission.passed}/${submission.total} tests`
                : ""}
            </span>
          </div>
        </div>

        <div>
          <span className="block font-mono text-[10px] uppercase text-charcoal/60">Submitted At</span>
          <p className="mt-0.5 font-mono text-xs text-charcoal/80">
            {formatIST(submission.createdAt)}
          </p>
          {submission.runtimeMs !== null && (
            <p className="font-mono text-[11px] text-charcoal/60 mt-0.5">
              Runtime: {submission.runtimeMs}ms
            </p>
          )}
        </div>
      </div>

      {/* Internal Judge Message (if FAILED or detailed) */}
      {submission.detail && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Internal Judge Message (Admins Only)
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap overflow-x-auto bg-black/10 dark:bg-black/30 p-3 rounded">
            {submission.detail}
          </pre>
        </div>
      )}

      {/* Code Viewer */}
      <div className="lc-panel p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-bronze">
            <Terminal className="w-4 h-4" />
            Source Code ({submission.language})
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mecha-btn mecha-btn--ghost mecha-btn--sm text-xs inline-flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Code
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto">
            <code>{submission.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
