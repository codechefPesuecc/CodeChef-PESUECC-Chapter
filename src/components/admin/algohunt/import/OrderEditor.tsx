"use client";

import { useMemo, useState } from "react";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";
import type { ContentChallenge, ContentReport } from "@/server/algohunt/import/content";

interface Line {
  slug: string;
  included: boolean;
  points: number;
}

function initialLines(report: ContentReport): Line[] {
  const inOrder = [...report.stages].sort((a, b) => a.stageNumber - b.stageNumber)
    .map((s) => ({ slug: s.challenge.slug, included: true, points: s.points }));
  const rest = report.challenges.filter((c) => c.stageNumber === null)
    .map((c) => ({ slug: c.slug, included: report.stages.length === 0, points: 100 }));
  return [...inOrder, ...rest];
}

/**
 * Question order tab: which imported questions are in the hunt, in which order, and their points.
 * The last included question is the final (solving it finishes the hunt). Saved in one go; refused
 * once any team has played.
 */
export default function OrderEditor({ eventSlug, report, editable, onSaved }: {
  eventSlug: string;
  report: ContentReport;
  editable: boolean;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => initialLines(report));
  const [check, setCheck] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bySlug = useMemo(() => new Map<string, ContentChallenge>(report.challenges.map((c) => [c.slug, c])), [report.challenges]);
  const url = (dry: boolean) => `/api/admin/algohunt/import/stages?event=${encodeURIComponent(eventSlug)}${dry ? "&dryRun=1" : ""}`;

  const rows = lines.filter((l) => l.included).map((l, i) => ({ stageNumber: i + 1, challengeSlug: l.slug, points: l.points }));

  function move(index: number, by: number) {
    setLines((prev) => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setCheck(null);
  }

  function update(index: number, change: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...change } : l)));
    setCheck(null);
  }

  async function runCheck() {
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{ errors: string[]; warnings: string[] }>("POST", url(true), { rows });
      setCheck({ errors: res.errors, warnings: res.warnings });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save({ confirm }: { confirm: string }) {
    const res = await adminFetch<{ stages: number }>("POST", url(false), { rows, confirm });
    setConfirming(false);
    setNotice(`Saved: ${res.stages} questions. Question ${res.stages} is the final.`);
    onSaved();
  }

  if (report.challenges.length === 0) {
    return <p className="text-sm text-charcoal/70">No questions imported yet. Import them on the Questions tab first.</p>;
  }

  // Question number of each line (null when left out), counted over the included ones.
  const numbers = lines.reduce<(number | null)[]>(
    (acc, l) => [...acc, l.included ? acc.filter((n) => n !== null).length + 1 : null], [],
  );
  return (
    <div className="space-y-4">
      {!editable && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          The event has started, so the question order is frozen.
        </p>
      )}
      <ol className="divide-y divide-hairline rounded-xl border border-hairline bg-panel">
        {lines.map((line, index) => {
          const c = bySlug.get(line.slug);
          const number = numbers[index];
          const isFinal = number !== null && number === rows.length;
          return (
            <li key={line.slug} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${line.included ? "" : "opacity-60"}`}>
              <input
                type="checkbox"
                aria-label={`Include ${line.slug}`}
                checked={line.included}
                disabled={!editable}
                onChange={(e) => update(index, { included: e.target.checked })}
              />
              <span className="w-28 font-mono text-xs text-bronze">
                {line.included ? `Question ${number}${isFinal ? " (FINAL)" : ""}` : "not in hunt"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-chocolate">{c?.title ?? line.slug}</span>{" "}
                <span className="font-mono text-xs text-charcoal/60">{line.slug} · {c?.difficulty}</span>{" "}
                {c?.verifiedAt ? (
                  <span className="mecha-chip bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Verified ✓</span>
                ) : (
                  <span className="mecha-chip bg-red-500/15 text-red-700 dark:text-red-300">Not verified</span>
                )}
              </span>
              <label className="flex items-center gap-1 text-xs">
                Points
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={line.points}
                  disabled={!editable || !line.included}
                  onChange={(e) => update(index, { points: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  className="w-20 rounded border border-hairline bg-transparent px-1 py-0.5 font-mono"
                />
              </label>
              <span className="flex gap-1">
                <button type="button" className="mecha-btn px-2 py-0.5 text-xs" disabled={!editable || index === 0} onClick={() => move(index, -1)} aria-label="Move up">↑</button>
                <button type="button" className="mecha-btn px-2 py-0.5 text-xs" disabled={!editable || index === lines.length - 1} onClick={() => move(index, 1)} aria-label="Move down">↓</button>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-charcoal/60">
        Every team starts on Question 1. Solving a question and entering any unused code opens the next one; solving
        the final question finishes the hunt.
      </p>

      {check && (
        <div className="space-y-1 text-sm">
          {check.errors.map((e, i) => <p key={i} className="text-red-700 dark:text-red-300">✗ {e}</p>)}
          {check.warnings.map((w, i) => <p key={i} className="text-amber-800 dark:text-amber-200">⚠ {w}</p>)}
          {check.errors.length === 0 && <p className="text-emerald-700 dark:text-emerald-300">✓ The order is valid.</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {editable && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mecha-btn px-4 py-2 text-sm" onClick={() => void runCheck()} disabled={rows.length === 0}>
            Check order
          </button>
          <button
            type="button"
            className="mecha-btn mecha-btn--solid px-4 py-2 text-sm"
            disabled={!check || check.errors.length > 0}
            onClick={() => setConfirming(true)}
          >
            Save order
          </button>
        </div>
      )}

      <ConfirmAction
        open={confirming}
        title="Save the question order"
        consequences={`The hunt becomes ${rows.length} questions: ${rows.map((r) => r.challengeSlug).join(" → ")}. Question ${rows.length} is the final.`}
        confirmPhrase={eventSlug}
        confirmLabel="Save order"
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
