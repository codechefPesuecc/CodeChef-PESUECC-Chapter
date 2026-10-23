"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle, ClipboardCheck, Copy, ExternalLink, Loader2, Save } from "lucide-react";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { usePoll } from "@/components/algohunt/usePoll";
import { MAX_CLUES, parseClueLines, type ClueProblem, type ClueStatus } from "@/lib/algohunt/clues";
import { formatIST } from "@/lib/algohunt/format";
import type { CodeStatus } from "@/lib/algohunt/types";

interface ClueCode {
  serial: number;
  status: CodeStatus;
  placementNote: string | null;
  usedAt: number | null;
}

interface AdminClue {
  label: string;
  text: string;
  status: ClueStatus;
  foundAt: number | null;
  codes: ClueCode[];
}

interface AdminClueBook {
  clues: AdminClue[];
  unlinkedClues: string[];
  codesWithoutClue: ClueCode[];
  savedAt: number | null;
}

interface BookResponse {
  book: AdminClueBook;
  publicPath: string;
}

interface SaveResponse {
  ok: boolean;
  error?: string;
  count?: number;
  problems?: ClueProblem[];
  preview?: AdminClueBook;
}

const CLUE_CHIPS: Record<ClueStatus, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FOUND: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  UNAVAILABLE: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function serial(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

/** Paste, check and save the clue book; then watch which clues are found. */
export default function CluesAdmin({ eventSlug }: { eventSlug: string }) {
  const { data, error: loadError, refresh } = usePoll<BookResponse>(
    `/api/admin/algohunt/clues?event=${encodeURIComponent(eventSlug)}`,
    { intervalMs: 15_000, jitterMs: 2_000 },
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // The text last checked, with what the check found (saving is offered only for that exact text).
  const [checked, setChecked] = useState<{ text: string; problems: ClueProblem[]; preview: AdminClueBook | null } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const count = parseClueLines(text).length;
  const upToDate = checked?.text === text;
  const ready = upToDate && checked.problems.length === 0 && count > 0 && count <= MAX_CLUES;

  async function send(body: { confirm?: string }, dryRun: boolean): Promise<SaveResponse> {
    const res = await fetch(
      `/api/admin/algohunt/clues?event=${encodeURIComponent(eventSlug)}${dryRun ? "&dryRun=1" : ""}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, ...body }) },
    );
    return (await res.json()) as SaveResponse;
  }

  async function handleCheck() {
    setBusy(true);
    setError(null);
    setSavedMessage(null);
    try {
      const json = await send({}, true);
      if (!json.ok) setError(json.error ?? "Couldn't check the clues.");
      else setChecked({ text, problems: json.problems ?? [], preview: json.preview ?? null });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(payload: { confirm: string }) {
    setBusy(true);
    setError(null);
    try {
      const json = await send({ confirm: payload.confirm }, false);
      if (!json.ok) {
        if (!json.problems) throw new Error(json.error ?? "Saving failed. Nothing was changed.");
        setError(json.error ?? "Some clues can't be saved.");
        setChecked({ text, problems: json.problems, preview: null });
        return;
      }
      setText("");
      setChecked(null);
      setSavedMessage(`Saved ${json.count} clues. Phones show the new list within 10 seconds.`);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(path: string) {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  const book = data?.book;
  const preview = upToDate ? checked.preview : null;

  return (
    <div className="space-y-6">
      {data && (
        <div className="lc-panel flex flex-wrap items-center gap-3 p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-bronze">Public link</span>
          <code className="min-w-0 flex-1 break-all rounded bg-hairline/40 px-2 py-1 font-mono text-xs text-chocolate">
            {data.publicPath}
          </code>
          <button type="button" onClick={() => copyLink(data.publicPath)} className="mecha-btn mecha-btn--sm text-xs inline-flex items-center gap-2">
            {copied ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={data.publicPath}
            target="_blank"
            rel="noreferrer"
            className="mecha-btn mecha-btn--ghost mecha-btn--sm text-xs inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Open
          </a>
          <p className="w-full text-xs text-charcoal/60">
            No login needed, so teammates&apos; phones never sign the team laptop out. Clues stay hidden until the event is
            live.
          </p>
        </div>
      )}

      <div className="lc-panel p-5 space-y-4">
        <h2 className="font-display text-lg font-bold text-chocolate flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-bronze" /> Paste the Clue Book
        </h2>
        <p className="text-xs text-charcoal/70">
          One clue per line: the label, then the riddle, separated by a tab, a colon, a comma or{" "}
          <span className="font-mono">·</span>. You can paste two columns from a sheet. A label links to every code whose
          placement note starts with it (<span className="font-mono">CL-012 · Outside the library</span>). Saving
          replaces the whole clue book.
        </p>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {savedMessage && (
          <p role="status" className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4" /> {savedMessage}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="clue-text" className="block text-xs font-mono uppercase text-charcoal/70">
            Clues ({count})
          </label>
          <textarea
            id="clue-text"
            className="mecha-input font-mono text-xs min-h-48"
            placeholder={"CL-001\tI have keys but open no doors.\nCL-002: I run but never walk."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            disabled={busy}
          />
        </div>

        {upToDate && checked.problems.length > 0 && (
          <div role="alert" className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold">
              {checked.problems.length === 1 ? "1 problem: fix it" : `${checked.problems.length} problems: fix them`} and
              check again.
            </p>
            <ul className="space-y-0.5 font-mono">
              {checked.problems.map((p, i) => (
                <li key={i}>
                  Line {p.line}: {p.label || "(no label)"}: {p.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {preview && <LinkWarnings book={preview} />}
        {ready && (
          <p role="status" className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4" /> All {count} clues are ready to save.
          </p>
        )}
        {count > MAX_CLUES && (
          <p className="text-xs text-red-700 dark:text-red-300">
            That&apos;s {count} clues. Save at most {MAX_CLUES}.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy || count === 0 || count > MAX_CLUES}
            onClick={handleCheck}
            className="mecha-btn mecha-btn--sm text-xs inline-flex items-center gap-2"
          >
            {busy && !confirmOpen ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Check clues
          </button>
          <button
            type="button"
            disabled={busy || !ready}
            onClick={() => setConfirmOpen(true)}
            className="mecha-btn mecha-btn--solid mecha-btn--sm text-xs inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save clue book
          </button>
        </div>
      </div>

      <div className="lc-panel p-5 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-chocolate">Saved Clues ({book?.clues.length ?? 0})</h2>
          {book?.savedAt && <span className="text-xs font-mono text-charcoal/60">Saved {formatIST(book.savedAt, { withDate: true })}</span>}
        </div>
        {!book ? (
          <p className="text-sm text-charcoal/70">{loadError ?? "Loading…"}</p>
        ) : book.clues.length === 0 ? (
          <p className="text-sm text-charcoal/70">No clue book yet. Paste one above.</p>
        ) : (
          <>
            <LinkWarnings book={book} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/50">
                    <th scope="col" className="px-2 py-2 font-medium">Label</th>
                    <th scope="col" className="px-2 py-2 font-medium">Riddle</th>
                    <th scope="col" className="px-2 py-2 font-medium">Status</th>
                    <th scope="col" className="px-2 py-2 font-medium">Codes</th>
                  </tr>
                </thead>
                <tbody>
                  {book.clues.map((clue) => (
                    <tr key={clue.label} className="border-b border-hairline last:border-0 align-top">
                      <td className="px-2 py-2 font-mono font-semibold whitespace-nowrap">{clue.label}</td>
                      <td className="px-2 py-2 text-charcoal/80 min-w-48">{clue.text}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={`mecha-chip text-[11px] ${CLUE_CHIPS[clue.status]}`}>{clue.status}</span>
                        {clue.foundAt !== null && <span className="block mt-1 text-xs text-charcoal/60">{formatIST(clue.foundAt)}</span>}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {clue.codes.length === 0 ? (
                          <span className="text-amber-700 dark:text-amber-300">No code</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {clue.codes.map((code) => (
                              <li key={code.serial}>
                                <span className="font-mono">{serial(code.serial)}</span>{" "}
                                <span className="text-charcoal/60">{code.status}</span>
                                {code.placementNote && <span className="block text-charcoal/60">{code.placementNote}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConfirmAction
        open={confirmOpen}
        title="Save Clue Book"
        consequences={`This replaces the whole clue book for ${eventSlug} with ${count} clues. Phones showing the clue book update within 10 seconds.`}
        confirmPhrase={eventSlug}
        confirmLabel="Save Now"
        onConfirm={handleSave}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/** Clues nobody can find (no code links to them) and codes placed under a label the clue book lacks. */
function LinkWarnings({ book }: { book: AdminClueBook }) {
  if (book.unlinkedClues.length === 0 && book.codesWithoutClue.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-2">
      {book.unlinkedClues.length > 0 && (
        <p className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <span className="font-semibold">No code points at {book.unlinkedClues.length === 1 ? "this clue" : "these clues"}:</span>{" "}
            <span className="font-mono">{book.unlinkedClues.join(", ")}</span>. Set a code&apos;s placement note to start with
            the label, or teams will never find a QR there.
          </span>
        </p>
      )}
      {book.codesWithoutClue.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <p className="font-semibold">Codes placed under a label that isn&apos;t in the clue book:</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              {book.codesWithoutClue.map((code) => (
                <li key={code.serial}>
                  {serial(code.serial)} ({code.status}): {code.placementNote}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
