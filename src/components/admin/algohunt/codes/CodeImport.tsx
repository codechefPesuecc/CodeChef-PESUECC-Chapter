"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Upload } from "lucide-react";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { parseCodeLines, type CodeLine } from "./codeImportModel";

const MAX_CODES = 200;

interface Problem {
  row: number;
  code: string;
  message: string;
  duplicateOf?: number;
}

interface ImportResponse {
  ok: boolean;
  error?: string;
  problems?: Problem[];
  batch?: { id: string; name: string } | null;
  codes?: { serial: number; code: string }[];
}

/** The pasted-text line of a 1-based row in the list sent to the server. */
function lineOf(lines: CodeLine[], row: number): number {
  return lines[row - 1]?.line ?? row;
}

/** Imports codes the organizers chose themselves (QR stickers printed before the event). */
export default function CodeImport({
  eventSlug,
  onImported,
}: {
  eventSlug: string;
  onImported: (batch: { id: string; name: string }, serials: number[]) => void;
}) {
  const [name, setName] = useState("Own codes");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The text last checked, with what the check found (an import is offered only for that exact text).
  const [checked, setChecked] = useState<{ text: string; lines: CodeLine[]; problems: Problem[] } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const lines = parseCodeLines(text);
  const upToDate = checked?.text === text;
  const ready = upToDate && checked.problems.length === 0 && lines.length > 0;

  async function send(body: { confirm?: string }, dryRun: boolean): Promise<ImportResponse> {
    const res = await fetch(
      `/api/admin/algohunt/codes/import?event=${encodeURIComponent(eventSlug)}${dryRun ? "&dryRun=1" : ""}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          codes: lines.map((l) => (l.note ? { code: l.code, note: l.note } : { code: l.code })),
          ...body,
        }),
      },
    );
    return (await res.json()) as ImportResponse;
  }

  async function handleCheck() {
    setBusy(true);
    setError(null);
    try {
      const json = await send({}, true);
      if (!json.ok) setError(json.error ?? "Couldn't check the codes.");
      else setChecked({ text, lines, problems: json.problems ?? [] });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(payload: { confirm: string }) {
    setBusy(true);
    setError(null);
    try {
      const json = await send({ confirm: payload.confirm }, false);
      if (!json.ok || !json.batch || !json.codes) {
        setError(json.error ?? "Import failed.");
        if (json.problems) setChecked({ text, lines, problems: json.problems });
        return;
      }
      setConfirmOpen(false);
      setText("");
      setChecked(null);
      onImported(json.batch, json.codes.map((c) => c.serial));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="import-codes-section" className="lc-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-chocolate flex items-center gap-2">
          <Upload className="w-5 h-5 text-bronze" /> Import Your Own Codes
        </h2>
        <span className="text-xs font-mono text-charcoal/60">1–{MAX_CODES} codes per import</span>
      </div>
      <p className="text-xs text-charcoal/70">
        For QR stickers you printed yourself. One code per line, then where it&apos;s placed:{" "}
        <span className="font-mono">7FQ2-M8K3, CL-001 · Ground floor, east wing</span>. You can also paste columns from a sheet
        (code first). Codes are 8 letters and digits, and each code can belong to only one event, so import into the
        real event.
      </p>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="import-batch-name" className="block text-xs font-mono uppercase text-charcoal/70">
          Batch Name
        </label>
        <input
          id="import-batch-name"
          type="text"
          className="mecha-input text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          disabled={busy}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="import-codes" className="block text-xs font-mono uppercase text-charcoal/70">
          Codes ({lines.length})
        </label>
        <textarea
          id="import-codes"
          className="mecha-input font-mono text-xs min-h-48"
          placeholder={"7FQ2-M8K3, CL-001 · Ground floor, east wing\n9KD4-W2PX, CL-002 · Second floor, west wing"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          disabled={busy}
        />
      </div>

      {upToDate && checked.problems.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-semibold">
            {checked.problems.length === 1 ? "1 problem: fix it" : `${checked.problems.length} problems: fix them`} and check
            again.
          </p>
          <ul className="space-y-0.5 font-mono">
            {checked.problems.map((p, i) => (
              <li key={i}>
                Line {lineOf(checked.lines, p.row)}: {p.code || "(empty)"}:{" "}
                {p.duplicateOf ? `Same code as line ${lineOf(checked.lines, p.duplicateOf)}.` : p.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ready && (
        <p role="status" className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-4 h-4" /> All {lines.length} codes are ready to import.
        </p>
      )}
      {lines.length > MAX_CODES && (
        <p className="text-xs text-red-700 dark:text-red-300">
          That&apos;s {lines.length} codes. Import at most {MAX_CODES} at a time.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={busy || lines.length === 0 || lines.length > MAX_CODES || !name.trim()}
          onClick={handleCheck}
          className="mecha-btn mecha-btn--sm text-xs inline-flex items-center gap-2"
        >
          {busy && !confirmOpen ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Check codes
        </button>
        <button
          type="button"
          disabled={busy || !ready || !name.trim()}
          onClick={() => setConfirmOpen(true)}
          className="mecha-btn mecha-btn--solid mecha-btn--sm text-xs inline-flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> Import {ready ? lines.length : ""} codes
        </button>
      </div>

      <ConfirmAction
        open={confirmOpen}
        title="Import Codes"
        consequences={`This adds ${lines.length} codes to "${name.trim()}". They work as soon as the event is live, and can't be moved to another event.`}
        confirmPhrase={eventSlug}
        confirmLabel="Import Now"
        onConfirm={handleImport}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
