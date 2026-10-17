"use client";

import { useState } from "react";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";
import { chunkTests } from "./importModel";

interface DryRunReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { tests: number; samples: number; totalChars: number; largestInputChars: number };
}

interface VerifyReport {
  reference: { verdict: string; passed: number; total: number; failedOn?: number; wallMs: number };
  brute?: { verdict: string; passed: number; total: number; wallMs: number };
  verified: boolean;
  warnings: string[];
}

type Step = "checking" | "invalid" | "ready" | "importing" | "verifying" | "done" | "failed";

interface FileState {
  name: string;
  slug: string | null;
  title: string | null;
  step: Step;
  report?: DryRunReport;
  sha256?: string;
  progress?: { done: number; total: number };
  verify?: VerifyReport;
  replaced?: boolean;
  challengeId?: string;
  error?: string;
  /** Kept in memory only for this tab; never shown. */
  raw?: Record<string, unknown>;
}

const STEP_LABEL: Record<Step, string> = {
  checking: "Checking…",
  invalid: "Fix the errors and drop the file again",
  ready: "Ready to import",
  importing: "Importing…",
  verifying: "Verifying on Akiro…",
  done: "Imported",
  failed: "Failed",
};

async function postJson<T extends object>(url: string, text: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: text });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null) as ({ ok?: boolean; error?: string } & T) | null;
  if (!response.ok || !data || data.ok !== true) throw new Error(data?.error || `The upload failed (HTTP ${response.status}).`);
  return data;
}

/**
 * Questions tab: drop question JSON files, check them, import them (row, then tests in chunks) and
 * verify each on Akiro. Test data and solutions are never shown: only counts, sizes and verdicts.
 */
export default function QuestionsImport({ eventSlug, editable, onChanged }: {
  eventSlug: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragging, setDragging] = useState(false);
  const base = `/api/admin/algohunt/import/challenge?event=${encodeURIComponent(eventSlug)}`;

  function patch(name: string, update: Partial<FileState>) {
    setFiles((prev) => prev.map((f) => (f.name === name ? { ...f, ...update } : f)));
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      if (!file.name.toLowerCase().endsWith(".json")) continue;
      setFiles((prev) => [...prev.filter((f) => f.name !== file.name), { name: file.name, slug: null, title: null, step: "checking" }]);
      try {
        const text = await file.text();
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(text) as Record<string, unknown>;
        } catch {
          patch(file.name, { step: "invalid", error: "This file isn't valid JSON." });
          continue;
        }
        const res = await postJson<{ report: DryRunReport; sha256: string }>(`${base}&dryRun=1`, text);
        patch(file.name, {
          step: res.report.ok ? "ready" : "invalid",
          report: res.report,
          sha256: res.sha256,
          slug: typeof raw.slug === "string" ? raw.slug : null,
          title: typeof raw.title === "string" ? raw.title : null,
          raw: res.report.ok ? raw : undefined,
        });
      } catch (error) {
        patch(file.name, { step: "failed", error: (error as Error).message });
      }
    }
  }

  async function importFile(f: FileState) {
    if (!f.raw || !f.sha256) return;
    patch(f.name, { step: "importing", error: undefined, progress: undefined });
    try {
      const { tests, ...row } = f.raw as { tests: { input: string; output: string }[] } & Record<string, unknown>;
      const samples = (row.samples as { input: string; output: string }[]) ?? [];
      const commit = await postJson<{ challengeId: string; replaced: boolean }>(base, JSON.stringify({ ...row, sourceSha256: f.sha256 }));
      const chunks = chunkTests(samples, tests);
      const total = samples.length + tests.length;
      let done = 0;
      patch(f.name, { progress: { done, total }, replaced: commit.replaced, challengeId: commit.challengeId });
      for (const chunk of chunks) {
        await postJson(`/api/admin/algohunt/challenges/${commit.challengeId}/tests`, JSON.stringify(chunk));
        done += chunk.tests.length;
        patch(f.name, { progress: { done, total } });
      }
      await verify(f.name, commit.challengeId);
    } catch (error) {
      patch(f.name, { step: "failed", error: (error as Error).message });
      onChanged();
    }
  }

  async function verify(name: string, challengeId: string) {
    patch(name, { step: "verifying", error: undefined });
    try {
      const { report } = await adminFetch<{ report: VerifyReport }>("POST", `/api/admin/algohunt/challenges/${challengeId}/verify`);
      patch(name, { step: "done", verify: report, raw: undefined });
    } catch (error) {
      patch(name, { step: "done", raw: undefined, error: `Uploaded, but verification failed: ${(error as Error).message}` });
    }
    onChanged();
  }

  const ready = files.filter((f) => f.step === "ready");

  return (
    <div className="space-y-4">
      {!editable && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          The event has started, so questions are frozen. You can still check files here.
        </p>
      )}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm ${
          dragging ? "border-bronze bg-bronze/10" : "border-hairline bg-panel"
        }`}
      >
        <span className="font-semibold text-chocolate">Drop question .json files here, or click to choose</span>
        <span className="text-xs text-charcoal/60">Each file is checked first. Nothing is stored until you press Import.</span>
        <input type="file" accept=".json,application/json" multiple className="sr-only" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </label>

      {ready.length > 1 && editable && (
        <button type="button" className="mecha-btn mecha-btn--solid px-4 py-2 text-sm" onClick={async () => { for (const f of ready) await importFile(f); }}>
          Import all {ready.length} ready files
        </button>
      )}

      <ul className="space-y-3">
        {files.map((f) => (
          <li key={f.name} className="rounded-xl border border-hairline bg-panel p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-chocolate">
                {f.title ?? f.name} {f.slug && <span className="font-mono text-xs text-charcoal/60">({f.slug})</span>}
              </p>
              <span className={`font-mono text-xs uppercase tracking-wider ${
                f.step === "done" && f.verify?.verified ? "text-emerald-600" : f.step === "invalid" || f.step === "failed" ? "text-red-600" : "text-bronze"
              }`}>
                {f.step === "done" ? (f.verify?.verified ? "Verified ✓" : "Imported, NOT verified") : STEP_LABEL[f.step]}
              </span>
            </div>
            {f.report && (
              <p className="mt-1 font-mono text-xs text-charcoal/70">
                {f.report.stats.samples} samples · {f.report.stats.tests} tests · {(f.report.stats.totalChars / 1_000_000).toFixed(2)}M chars
                · largest input {(f.report.stats.largestInputChars / 1000).toFixed(0)}K chars
              </p>
            )}
            {f.error && <p className="mt-2 text-red-700 dark:text-red-300">{f.error}</p>}
            {f.report && f.report.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-red-700 dark:text-red-300">
                {f.report.errors.slice(0, 15).map((e, i) => <li key={i}>{e}</li>)}
                {f.report.errors.length > 15 && <li>…and {f.report.errors.length - 15} more</li>}
              </ul>
            )}
            {f.report && f.report.warnings.length > 0 && f.step !== "done" && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-800 dark:text-amber-200">
                {f.report.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {f.progress && f.step === "importing" && (
              <div className="mt-2">
                <p className="text-xs">Uploading tests {f.progress.done}/{f.progress.total}…</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-hairline">
                  <div className="h-full bg-bronze" style={{ width: `${(100 * f.progress.done) / Math.max(1, f.progress.total)}%` }} />
                </div>
              </div>
            )}
            {f.verify && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="font-mono">
                  Reference: {f.verify.reference.verdict} · {f.verify.reference.passed}/{f.verify.reference.total} tests
                  · {(f.verify.reference.wallMs / 1000).toFixed(1)} s
                  {f.verify.brute && ` · Brute: ${f.verify.brute.verdict} (${(f.verify.brute.wallMs / 1000).toFixed(1)} s)`}
                </p>
                {f.replaced && <p className="text-amber-800 dark:text-amber-200">This replaced the earlier version of {f.slug}.</p>}
                {f.verify.warnings.map((w, i) => <p key={i} className="text-amber-800 dark:text-amber-200">{w}</p>)}
              </div>
            )}
            {f.step === "ready" && editable && (
              <button type="button" className="mecha-btn mecha-btn--solid mt-3 px-3 py-1.5 text-xs" onClick={() => void importFile(f)}>
                Import{f.report && f.report.warnings.length > 0 ? " anyway" : ""}
              </button>
            )}
            {f.step === "done" && !f.verify?.verified && f.challengeId && (
              <button type="button" className="mecha-btn mt-3 px-3 py-1.5 text-xs" onClick={() => void verify(f.name, f.challengeId!)}>
                Verify again
              </button>
            )}
            {f.step === "failed" && f.raw && editable && (
              <button type="button" className="mecha-btn mt-3 px-3 py-1.5 text-xs" onClick={() => void importFile(f)}>
                Try again
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
