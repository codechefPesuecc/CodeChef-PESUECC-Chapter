"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import CodeEditor from "./CodeEditor";
import {
  INITIAL_STANDINGS,
  LANGUAGES,
  STARTER_CODE,
  formatClock,
  languageLabel,
  type LanguageId,
  type Solver,
} from "./mockData";
import { BASE_POINTS, BOUNTY_LADDER, ordinal, pointsForRank } from "@/lib/points";
import { FLAG_LIMIT, useIntegrityMonitor } from "./useIntegrityMonitor";

const FILE_EXT: Record<LanguageId, string> = {
  cpp: "cpp",
  python: "py",
  java: "java",
};

type Judgement = {
  mode: "run" | "submit";
  status: "AC" | "WA";
} | null;

export default function ArenaWorkspace({
  problem,
  sampleInput,
  sampleOutput,
}: {
  problem: ReactNode;
  sampleInput: string;
  sampleOutput: string;
}) {
  const [language, setLanguage] = useState<LanguageId>("cpp");
  const [code, setCode] = useState<string>(STARTER_CODE.cpp);
  const [running, setRunning] = useState(false);
  const [judgement, setJudgement] = useState<Judgement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mySolveSeconds, setMySolveSeconds] = useState<number | null>(null);
  const [myLanguage, setMyLanguage] = useState<LanguageId>("cpp");
  const [myFlags, setMyFlags] = useState(0);
  const [pageFocused, setPageFocused] = useState(true);

  const startRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live "your time" clock. Freezes the moment an accepted solution lands.
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      if (!frozenRef.current && startRef.current != null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => {
      clearInterval(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const solved = mySolveSeconds != null;
  const integrity = useIntegrityMonitor(!solved);

  // Blur the problem when the window/tab loses focus — a screenshot deterrent
  // (e.g. the OS snip overlay steals focus, so it captures a blurred panel).
  useEffect(() => {
    const focus = () => setPageFocused(true);
    const blur = () => setPageFocused(false);
    const visibility = () =>
      setPageFocused(document.visibilityState === "visible");
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  // Placeholder verdict: the real judge (Piston sandbox via /api/submit) isn't
  // wired yet, so a solution counts as accepted once it meaningfully diverges
  // from the starter template. Swap this for the sandbox response later.
  const looksAttempted = () =>
    code.trim() !== STARTER_CODE[language].trim() && code.trim().length > 24;

  const changeLanguage = (next: LanguageId) => {
    setCode((current) =>
      current.trim() === STARTER_CODE[language].trim()
        ? STARTER_CODE[next]
        : current,
    );
    setLanguage(next);
  };

  const resetCode = () => setCode(STARTER_CODE[language]);

  const runSample = () => {
    if (running) return;
    setRunning(true);
    setJudgement(null);
    timeoutRef.current = setTimeout(() => {
      setJudgement({ mode: "run", status: looksAttempted() ? "AC" : "WA" });
      setRunning(false);
    }, 700);
  };

  const submit = () => {
    if (running || solved) return;
    setRunning(true);
    setJudgement(null);
    timeoutRef.current = setTimeout(() => {
      if (looksAttempted()) {
        frozenRef.current = true;
        setMySolveSeconds(elapsed);
        setMyLanguage(language);
        setMyFlags(integrity.total);
        setJudgement({ mode: "submit", status: "AC" });
      } else {
        setJudgement({ mode: "submit", status: "WA" });
      }
      setRunning(false);
    }, 1100);
  };

  // Too many integrity flags removes you from the day's top 10: an accepted
  // solve then only earns the 100-point base and is listed as flagged.
  const flaggedSolve = solved && myFlags > FLAG_LIMIT;
  const eligibleYou = solved && !flaggedSolve;

  // Derive the live board: faster solve durations rank higher (the speed bounty).
  const you: Solver = {
    name: "You",
    handle: "you",
    initials: "YOU",
    language: languageLabel(myLanguage),
    timeSeconds: mySolveSeconds ?? 0,
    isYou: true,
  };
  const ranked = [...INITIAL_STANDINGS, ...(eligibleYou ? [you] : [])].sort(
    (a, b) => a.timeSeconds - b.timeSeconds,
  );
  const myRank = eligibleYou ? ranked.findIndex((s) => s.isYou) + 1 : null;
  const myPoints = flaggedSolve
    ? BASE_POINTS
    : myRank
      ? pointsForRank(myRank)
      : null;
  const flaggedYou: Solver | null = flaggedSolve ? you : null;

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Problem statement */}
        <section className="overflow-hidden rounded-2xl border border-hairline bg-panel shadow-sm">
          <PanelBar label="Problem" />
          <div className="relative">
            <div
              // `data-lenis-prevent` lets this panel scroll natively instead of
              // Lenis hijacking the wheel for the whole page.
              data-lenis-prevent
              className="arena-no-print max-h-[560px] select-none overflow-y-auto overscroll-contain px-6 py-6 lg:max-h-[720px]"
              onCopyCapture={(e) => {
                e.preventDefault();
                integrity.record("copy");
              }}
              onCutCapture={(e) => {
                e.preventDefault();
                integrity.record("cut");
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                integrity.record("context-menu");
              }}
            >
              {problem}
            </div>
            <Watermark tag="@you · PESUECC Arena" />
            {!pageFocused && <ScreenGuard />}
          </div>
        </section>

        {/* Editor + console */}
        <section className="space-y-4 lg:sticky lg:top-28">
          <div className="overflow-hidden rounded-2xl border border-hairline shadow-sm">
            {/* IDE title bar */}
            <div className="flex items-center gap-3 border-b border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-[#e06c5b]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e0b24b]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#5bbf7a]" />
              </span>
              <span className="font-mono text-xs text-[var(--ide-ink)]">
                main.{FILE_EXT[language]}
              </span>
              <div className="ml-auto flex items-center gap-3">
                <label className="sr-only" htmlFor="language">
                  Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value as LanguageId)}
                  className="rounded-md border border-[var(--ide-border)] bg-[var(--ide-body)] px-2 py-1 text-xs font-medium text-[var(--ide-ink-strong)] outline-none transition-colors focus:border-bronze"
                >
                  {LANGUAGES.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      style={{
                        backgroundColor: "var(--ide-body)",
                        color: "var(--ide-ink-strong)",
                      }}
                    >
                      {l.label}
                    </option>
                  ))}
                </select>
                <span
                  title="Indicative timer — your official solve time is recorded server-side on an accepted submission."
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--ide-ink)]"
                >
                  <ClockIcon />
                  {formatClock(elapsed)}
                </span>
                <span
                  title={`Copy, paste and right-click are disabled · tab switches are recorded · more than ${FLAG_LIMIT} flags removes you from the top 10`}
                  className={`inline-flex items-center gap-1.5 font-mono text-xs ${
                    integrity.flagged
                      ? "text-red-400"
                      : integrity.total > 0
                        ? "text-amber-400"
                        : "text-[var(--ide-ink-dim)]"
                  }`}
                >
                  <ShieldIcon />
                  <span className="hidden sm:inline">
                    {integrity.flagged ? "Flagged" : "Proctored"}
                  </span>
                  {integrity.total > 0 && <span>· {integrity.total}</span>}
                </span>
              </div>
            </div>

            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              lockClipboard
              onBlocked={integrity.record}
            />

            {/* Action bar */}
            <div className="flex items-center gap-3 border-t border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-3">
              <button
                type="button"
                onClick={resetCode}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ide-ink)] transition-colors hover:text-[var(--ide-ink-strong)]"
              >
                <ResetIcon />
                Reset
              </button>
              <div className="ml-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={runSample}
                  disabled={running}
                  className="inline-flex items-center gap-2 rounded-lg border border-bronze/60 px-4 py-2 text-sm font-semibold text-bronze transition-colors hover:bg-bronze/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayIcon />
                  Run
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={running || solved}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed ${
                    solved
                      ? "bg-emerald-600 disabled:opacity-100"
                      : "bg-bronze hover:bg-bronze/90 disabled:opacity-60"
                  }`}
                >
                  {solved ? (
                    <>
                      <CheckIcon />
                      Solved
                    </>
                  ) : (
                    <>
                      <BoltIcon />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {integrity.total > 0 && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                integrity.flagged
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              <ShieldIcon />
              <span>
                {integrity.notice ??
                  (integrity.flagged
                    ? "Removed from today's top 10 — an accepted solve now earns only the 100-point base."
                    : "Stay under 5 flags to keep your top-10 bounty eligibility.")}
              </span>
              <span className="ml-auto shrink-0 font-mono">
                {integrity.total}/{FLAG_LIMIT} flags
              </span>
            </div>
          )}

          <Console
            running={running}
            judgement={judgement}
            sampleInput={sampleInput}
            sampleOutput={sampleOutput}
            myRank={myRank}
            myPoints={myPoints}
            flagged={flaggedSolve}
            flagCount={myFlags}
            solveClock={mySolveSeconds != null ? formatClock(mySolveSeconds) : ""}
          />
        </section>
      </div>

      <SpeedBounty />
      <Standings ranked={ranked} flaggedYou={flaggedYou} />
    </div>
  );
}

/* --- Console --- */

function Console({
  running,
  judgement,
  sampleInput,
  sampleOutput,
  myRank,
  myPoints,
  flagged,
  flagCount,
  solveClock,
}: {
  running: boolean;
  judgement: Judgement;
  sampleInput: string;
  sampleOutput: string;
  myRank: number | null;
  myPoints: number | null;
  flagged: boolean;
  flagCount: number;
  solveClock: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ide-ink-dim)]">
          Console
        </span>
        <VerdictBadge running={running} judgement={judgement} />
      </div>
      <div className="min-h-[150px] bg-[var(--ide-body)] px-4 py-4 font-mono text-xs leading-relaxed text-[var(--ide-code)]">
        {running ? (
          <p className="flex items-center gap-2 text-bronze">
            <span className="h-2 w-2 animate-pulse rounded-full bg-bronze" />
            Judging against sample &amp; hidden cases…
          </p>
        ) : judgement?.status === "AC" && judgement.mode === "submit" ? (
          flagged ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Accepted — all test cases passed.
              </p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
                <ShieldIcon />
                Flagged {flagCount} times — removed from today&apos;s top 10.
              </p>
              <p className="text-[var(--ide-code)]">
                You solved it in{" "}
                <span className="font-semibold text-[var(--ide-ink-strong)]">
                  {solveClock}
                </span>
                , but with more than {FLAG_LIMIT} integrity flags this solve earns
                only the base{" "}
                <span className="font-semibold text-[var(--ide-ink-strong)]">
                  +{myPoints} pts
                </span>
                .
              </p>
              <p className="text-[11px] text-[var(--ide-ink-dim)]">
                Verdict simulated on the client — the Piston sandbox judge is
                wired in a later pass.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Accepted — all test cases passed.
              </p>
              <p className="text-[var(--ide-code)]">
                You finished{" "}
                <span className="font-semibold text-[var(--ide-ink-strong)]">
                  {myRank ? ordinal(myRank) : ""}
                </span>{" "}
                today in{" "}
                <span className="font-semibold text-[var(--ide-ink-strong)]">
                  {solveClock}
                </span>{" "}
                ·{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{myPoints} pts
                </span>
              </p>
              <p className="text-[11px] text-[var(--ide-ink-dim)]">
                Verdict simulated on the client — the Piston sandbox judge is
                wired in a later pass.
              </p>
            </div>
          )
        ) : judgement ? (
          <div className="space-y-3">
            {judgement.status === "WA" && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Wrong Answer on sample case.
              </p>
            )}
            <IoBlock label="Input" value={sampleInput} />
            <IoBlock label="Expected" value={sampleOutput} />
            <IoBlock
              label="Your output"
              value={judgement.status === "AC" ? sampleOutput : "—"}
              tone={judgement.status === "AC" ? "ok" : "bad"}
            />
            {judgement.mode === "run" && (
              <p className="text-[11px] text-[var(--ide-ink-dim)]">
                Sample run simulated on the client. Use Submit to lock in your
                solve time.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[var(--ide-ink-dim)]">
            Write your solution, then{" "}
            <span className="text-bronze">Run</span> it against the sample or{" "}
            <span className="text-bronze">Submit</span> to the judge. Faster
            accepted solves earn more of the daily bounty.
          </p>
        )}
      </div>
    </div>
  );
}

function IoBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : "text-[var(--ide-code)]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--ide-ink-dim)]">
        {label}
      </div>
      <pre className={`mt-1 whitespace-pre-wrap ${color}`}>
        {value || "—"}
      </pre>
    </div>
  );
}

function VerdictBadge({
  running,
  judgement,
}: {
  running: boolean;
  judgement: Judgement;
}) {
  if (running) {
    return (
      <span className="rounded-full bg-bronze/20 px-2.5 py-0.5 text-[11px] font-semibold text-bronze">
        Running…
      </span>
    );
  }
  if (!judgement) return null;
  const map = {
    AC: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    WA: "bg-red-500/15 text-red-600 dark:text-red-400",
  } as const;
  const label = judgement.status === "AC" ? "Accepted" : "Wrong Answer";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[judgement.status]}`}
    >
      {label}
    </span>
  );
}

/* --- Speed bounty ladder --- */

function SpeedBounty() {
  const medal = ["#d9a441", "#b9b4ad", "#c08457"];
  return (
    <section className="rounded-2xl border border-hairline bg-panel p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-chocolate">
          Speed Bounty
        </h2>
        <p className="text-xs text-charcoal/60">
          Points by finish order — the faster you get accepted, the more you earn.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
        {BOUNTY_LADDER.map((tier, i) => (
          <div
            key={tier.label}
            className="rounded-xl border border-hairline bg-cream/40 px-3 py-3 text-center dark:bg-white/[0.03]"
          >
            <div
              className="font-mono text-[11px] font-semibold"
              style={{ color: i < 3 ? medal[i] : "var(--color-bronze)" }}
            >
              {tier.label}
            </div>
            <div className="mt-1 font-display text-xl font-bold text-chocolate">
              {tier.points}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-charcoal/50">
              {i === BOUNTY_LADDER.length - 1 ? "base" : "pts"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Live standings --- */

function Standings({
  ranked,
  flaggedYou,
}: {
  ranked: Solver[];
  flaggedYou: Solver | null;
}) {
  const solvedCount = ranked.length + (flaggedYou ? 1 : 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-panel shadow-sm">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <h2 className="font-display text-lg font-bold text-chocolate">
          Live Standings
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal/60">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {solvedCount} solved today
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
              <th className="px-6 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Solver</th>
              <th className="px-3 py-3 font-medium">Lang</th>
              <th className="px-3 py-3 font-medium">Time</th>
              <th className="px-6 py-3 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((solver, i) => {
              const rank = i + 1;
              return (
                <tr
                  key={solver.handle}
                  className={`border-t border-hairline ${
                    solver.isYou
                      ? "bg-bronze/10"
                      : i % 2 === 1
                        ? "bg-cream/40 dark:bg-white/[0.02]"
                        : ""
                  }`}
                >
                  <td className="px-6 py-3">
                    <RankBadge rank={rank} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                          solver.isYou
                            ? "bg-bronze text-white"
                            : "bg-bronze/15 text-bronze"
                        }`}
                      >
                        {solver.isYou ? "YOU" : solver.initials}
                      </span>
                      <div className="leading-tight">
                        <div className="font-semibold text-chocolate">
                          {solver.name}
                        </div>
                        <div className="font-mono text-[11px] text-charcoal/50">
                          @{solver.handle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-charcoal/70">
                    {solver.language}
                  </td>
                  <td className="px-3 py-3 font-mono text-charcoal/70">
                    {formatClock(solver.timeSeconds)}
                  </td>
                  <td className="px-6 py-3 text-right font-display font-bold text-brown">
                    {pointsForRank(rank)}
                  </td>
                </tr>
              );
            })}
            {flaggedYou && (
              <tr className="border-t border-hairline bg-red-500/10">
                <td className="px-6 py-3">
                  <span className="font-mono text-sm text-red-500">—</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/80 text-[11px] font-bold text-white">
                      YOU
                    </span>
                    <div className="leading-tight">
                      <div className="flex items-center gap-2 font-semibold text-chocolate">
                        {flaggedYou.name}
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                          Flagged
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-charcoal/50">
                        @{flaggedYou.handle}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-charcoal/70">
                  {flaggedYou.language}
                </td>
                <td className="px-3 py-3 font-mono text-charcoal/70">
                  {formatClock(flaggedYou.timeSeconds)}
                </td>
                <td className="px-6 py-3 text-right font-display font-bold text-brown">
                  {BASE_POINTS}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-[#d9a441]/20 text-[#b7842a]",
    2: "bg-[#b9b4ad]/25 text-[#7d7a76]",
    3: "bg-[#c08457]/20 text-[#a5623a]",
  };
  if (rank <= 3) {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${styles[rank]}`}
      >
        {rank}
      </span>
    );
  }
  return <span className="font-mono text-sm text-charcoal/50">{rank}</span>;
}

/* --- Screenshot deterrents --- */

// Faint, tiled, diagonal identity watermark. Purely a deterrent: it can't stop
// an OS screenshot, but it makes a leaked capture traceable to the solver.
// `tag` should become the authenticated handle/SRN once identity lands.
function Watermark({ tag }: { tag: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden opacity-[0.07]"
    >
      <div className="absolute left-1/2 top-1/2 flex h-[170%] w-[170%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] flex-wrap content-center justify-center gap-x-12 gap-y-10">
        {Array.from({ length: 90 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-wider text-chocolate"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// Shown over the problem while the window/tab is not focused.
function ScreenGuard() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-panel/70 text-center backdrop-blur-md">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bronze/15 text-bronze">
        <EyeOffIcon />
      </span>
      <p className="font-display text-sm font-semibold text-chocolate">
        Problem hidden
      </p>
      <p className="max-w-xs px-6 text-xs text-charcoal/60">
        Return to this tab to keep solving. Leaving the arena during a live solve
        is recorded.
      </p>
    </div>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

/* --- Small UI bits --- */

function PanelBar({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline px-6 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
      <span className="font-mono text-[11px] uppercase tracking-wider text-charcoal/50">
        {label}
      </span>
    </div>
  );
}

/* --- Icons --- */

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
