/**
 * Server component — the CP Arena rulebook. Collapsible so it stays visible
 * without pushing the editor too far down. Styled with brand tokens, so it
 * re-themes in dark mode automatically.
 */
const RULES: string[] = [
  "One Problem of the Day. Read the statement on the left and solve it in the browser editor on the right.",
  "Points are awarded by speed: the faster your first Accepted submission, the higher you rank on the daily board (1000 for 1st down to 100 for 10th and beyond).",
  "The on-screen timer is only indicative — your official solve time is recorded on the server the moment your submission is Accepted.",
  "Only your first Accepted submission counts toward the leaderboard.",
  "Copy, paste and right-click are disabled inside the arena, and switching tabs during a live solve is recorded for review.",
  "Accumulating more than 5 integrity flags (blocked paste/copy attempts, tab switches) removes you from that day's top 10 — an accepted solve then earns only the 100-point base.",
  "The problem statement can't be selected or copied, it's watermarked with your identity, and it blurs when you leave the tab — leaked problems are traceable back to you.",
  "Write your own code. Plagiarism, sharing solutions, or automating submissions leads to disqualification and forfeiting the bounty.",
  "Don't probe or exploit the judge, and don't attempt to extract the hidden test cases.",
];

export default function ArenaRules() {
  return (
    <details className="group mt-6 overflow-hidden rounded-2xl border border-hairline border-l-4 border-l-bronze bg-panel shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bronze/15 text-bronze">
          <BookIcon />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-base font-bold text-chocolate">
            How the CP Arena works · Rules
          </h2>
          <p className="text-xs text-charcoal/55">
            Scoring, fair play, and what gets you disqualified.
          </p>
        </div>
        <ChevronIcon />
      </summary>
      <ol className="space-y-3 border-t border-hairline px-6 py-5">
        {RULES.map((rule, i) => (
          <li key={i} className="flex gap-3 text-sm leading-6 text-charcoal/80">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bronze/15 font-mono text-[11px] font-bold text-bronze">
              {i + 1}
            </span>
            {rule}
          </li>
        ))}
      </ol>
    </details>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="text-charcoal/40 transition-transform group-open:rotate-180"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
