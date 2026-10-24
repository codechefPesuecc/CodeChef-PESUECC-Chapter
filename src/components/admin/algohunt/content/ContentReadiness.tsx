"use client";

import { useState } from "react";
import Link from "@/components/AppLink";
import { withEvent } from "@/components/admin/algohunt/nav/navModel";
import { formatIST } from "@/lib/algohunt/format";
import type { ContentReport } from "@/server/algohunt/import/content";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hairline bg-panel p-4 text-sm">
      <h2 className="font-mono text-[11px] uppercase tracking-wider text-bronze">{title}</h2>
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}

/** /admin/algohunt/content: can this event start? (M6 brief §7.4) */
export default function ContentReadiness({ eventSlug, initial }: { eventSlug: string; initial: ContentReport }) {
  const [report, setReport] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/algohunt/content?event=${encodeURIComponent(eventSlug)}`, { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; report?: ContentReport };
      if (data.ok && data.report) setReport(data.report);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          role="status"
          className={`rounded-xl border px-4 py-2 font-display text-2xl font-bold ${
            report.ready
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300"
          }`}
        >
          {report.ready ? "READY" : "NOT READY"}
        </span>
        <button type="button" className="mecha-btn px-3 py-1.5 text-xs" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {(report.problems.length > 0 || report.warnings.length > 0) && (
        <section className="space-y-1 text-sm">
          {report.problems.map((p, i) => <p key={`p${i}`} className="text-red-700 dark:text-red-300">✗ {p}</p>)}
          {report.warnings.map((w, i) => <p key={`w${i}`} className="text-amber-800 dark:text-amber-200">⚠ {w}</p>)}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Questions">
          <p><span className="font-mono font-semibold">{report.stages.length}</span> in the hunt</p>
          <p><span className="font-mono font-semibold">{report.challenges.length}</span> imported</p>
          <Link href={withEvent("/admin/algohunt/import", eventSlug)} className="text-xs text-bronze hover:underline">Import →</Link>
        </Card>
        <Card title="Code pool">
          <p><span className="font-mono font-semibold">{report.codes.active}</span> active · {report.codes.used} used · {report.codes.disabled} disabled</p>
          <p>{report.codes.batches} batch{report.codes.batches === 1 ? "" : "es"}</p>
          <Link href={withEvent("/admin/algohunt/codes", eventSlug)} className="text-xs text-bronze hover:underline">Codes →</Link>
        </Card>
        <Card title="Teams">
          <p><span className="font-mono font-semibold">{report.teams.checkedIn}</span> of {report.teams.total} checked in</p>
          <p>Ends: {report.endsAt ? `${formatIST(report.endsAt, { withDate: true })} IST` : "not scheduled"}</p>
          <Link href={withEvent("/admin/algohunt/teams", eventSlug)} className="text-xs text-bronze hover:underline">Teams →</Link>
        </Card>
      </div>

      <section className="space-y-3">
        {report.stages.map((stage) => (
          <article key={stage.stageNumber} className="rounded-2xl border border-hairline bg-panel p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-chocolate">
                Question {stage.stageNumber}{stage.isFinal ? " (FINAL)" : ""}: {stage.challenge.title}{" "}
                <span className="font-mono text-xs text-charcoal/60">{stage.challenge.slug} · {stage.challenge.difficulty} · {stage.points} pts</span>
              </h3>
              <span className={`font-mono text-xs ${stage.problems.length === 0 ? "text-emerald-600" : "text-red-600"}`}>
                {stage.problems.length === 0 ? "OK ✓" : "Problems"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-charcoal/70">
              {stage.challenge.samples} samples · {stage.challenge.tests} hidden tests · {(stage.challenge.totalChars / 1_000_000).toFixed(2)}M chars
              · {stage.challenge.verifiedAt ? `verified ${formatIST(stage.challenge.verifiedAt, { withDate: true })}` : "not verified"}
              {!stage.enabled && " · DISABLED"}
            </p>
            {stage.problems.map((p, i) => <p key={i} className="mt-1 text-red-700 dark:text-red-300">✗ {p}</p>)}
            <Link
              href={withEvent(`/admin/algohunt/content/${stage.challenge.id}`, eventSlug)}
              className="mt-2 inline-block text-xs text-bronze hover:underline"
            >
              Preview as a team sees it →
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
