"use client";

import { Ban, Check, Hourglass, MapPin, Sparkles, WifiOff } from "lucide-react";
import { splitClueBook, type PublicClue, type PublicClueBook } from "@/lib/algohunt/clues";
import { formatIST } from "@/lib/algohunt/format";
import { usePoll } from "../usePoll";

/**
 * The clue book teammates follow on their phones. Public (no team login, so it never signs the team
 * laptop out) and polled every 10 s: open clues first, then the ones already found.
 */
export default function ClueBook({ eventSlug }: { eventSlug: string | null }) {
  const url = eventSlug ? `/api/algohunt/clues?event=${encodeURIComponent(eventSlug)}` : "/api/algohunt/clues";
  const { data, error } = usePoll<PublicClueBook>(url, { intervalMs: 10_000, jitterMs: 2_000 });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-bronze">
          <MapPin aria-hidden className="h-3.5 w-3.5" /> AlgoHunt 2.0 · Clue book
        </p>
        <h1 className="font-display text-2xl font-bold text-chocolate sm:text-3xl">{data?.event.name ?? "Clue book"}</h1>
      </header>

      {data && error && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <WifiOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Showing the update from {formatIST(data.serverNow)}. {error}</span>
        </p>
      )}

      {!data ? (
        <p className="lc-panel p-4 text-sm text-charcoal/70">{error ?? "Loading the clue book…"}</p>
      ) : !data.visible ? (
        <div className="lc-panel flex items-start gap-3 p-5">
          <Hourglass aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-bronze" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">The clue book opens when the hunt starts.</p>
            <p className="text-charcoal/70">Keep this page open: it updates on its own.</p>
          </div>
        </div>
      ) : (
        <Clues book={data} />
      )}

      <p className="border-t border-hairline pt-4 text-xs text-charcoal/60">
        Any QR unlocks any question, but each works only once. Found clues are already used.
      </p>
    </div>
  );
}

function Clues({ book }: { book: PublicClueBook }) {
  const { open, justFound, done } = splitClueBook(book.clues, book.serverNow);
  const found = [...justFound, ...done];

  return (
    <>
      <div className="lc-panel p-5" aria-live="polite">
        <p className="font-display text-3xl font-bold text-chocolate">
          {book.openCount} <span className="text-lg font-semibold text-charcoal/70">of {book.total} clues still open</span>
        </p>
        <p className="mt-1 text-xs text-charcoal/60">
          {book.final
            ? "The hunt is over. These are the final statuses."
            : `${book.event.status === "PAUSED" ? "The hunt is paused. " : ""}Updated ${formatIST(book.serverNow)} · refreshes every 10 s`}
        </p>
      </div>

      {book.total === 0 ? (
        <p className="lc-panel p-4 text-sm text-charcoal/70">No clues yet. Check back soon.</p>
      ) : (
        <>
          <section aria-labelledby="ah-clues-open" className="space-y-3">
            <h2 id="ah-clues-open" className="font-display text-lg font-bold">Still open: go find these</h2>
            {open.length === 0 ? (
              <p className="lc-panel p-4 text-sm text-charcoal/70">Every clue has been found.</p>
            ) : (
              <ol className="space-y-3">
                {open.map((clue) => (
                  <li key={clue.label} className="lc-panel p-4">
                    <p className="font-mono text-sm font-semibold text-bronze">{clue.label}</p>
                    <p className="mt-1.5 whitespace-pre-line break-words text-base leading-relaxed">{clue.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {found.length > 0 && (
            <section aria-labelledby="ah-clues-found" className="space-y-2">
              <h2 id="ah-clues-found" className="font-display text-base font-bold text-charcoal/70">
                Already found ({found.length})
              </h2>
              <ol className="space-y-2">
                {justFound.map((clue) => <DoneCard key={clue.label} clue={clue} justFound />)}
                {done.map((clue) => <DoneCard key={clue.label} clue={clue} justFound={false} />)}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}

function DoneCard({ clue, justFound }: { clue: PublicClue; justFound: boolean }) {
  const time = clue.foundAt !== null ? ` · ${formatIST(clue.foundAt)}` : "";
  return (
    <li
      className={`rounded-lg border p-3 text-sm ${
        justFound
          ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/40"
          : "border-hairline bg-hairline/20 text-charcoal/60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`font-mono font-semibold ${justFound ? "text-chocolate" : ""}`}>{clue.label}</span>
        {clue.status === "UNAVAILABLE" ? (
          <span className="mecha-chip bg-charcoal/10 text-charcoal/70">
            <Ban aria-hidden className="h-3 w-3" /> Unavailable
          </span>
        ) : justFound ? (
          <span className="mecha-chip bg-amber-500/20 text-amber-800 dark:text-amber-300">
            <Sparkles aria-hidden className="h-3 w-3" /> Just found{time}
          </span>
        ) : (
          <span className="mecha-chip bg-charcoal/10 text-charcoal/70">
            <Check aria-hidden className="h-3 w-3" /> Found{time}
          </span>
        )}
      </div>
      <p className={`mt-1 whitespace-pre-line break-words ${justFound ? "text-charcoal/80" : "line-through decoration-charcoal/30"}`}>
        {clue.text}
      </p>
    </li>
  );
}
