"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import CodeEditor from "./CodeEditor";
import {
  LANGUAGES,
  STARTER_CODE,
  formatClock,
  languageLabel,
  type LanguageId,
} from "./mockData";
import { BASE_POINTS, BOUNTY_LADDER, ordinal } from "@/lib/points";
import { FLAG_LIMIT, useIntegrityMonitor } from "./useIntegrityMonitor";
import { useUser } from "@/components/auth/useUser";
import LeaderboardTable, { type LeaderRow } from "./LeaderboardTable";
import Turnstile, { turnstileConfigured } from "./Turnstile";
import MechaPanel from "./MechaPanel";
import Link from "next/link";

const FILE_EXT: Record<LanguageId, string> = {
  cpp: "cpp",
  c: "c",
  python: "py",
  java: "java",
  csharp: "cs",
  javascript: "js",
  go: "go",
  rust: "rs",
  zig: "zig",
};

type Verdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE";

type Judgement = {
  mode: "run" | "submit";
  // RAN = ran on custom input; CE = compile error; TLE/RE = runtime; ERR = infra
  status: Verdict | "RAN" | "ERR";
  input?: string;
  output?: string; // real stdout from Piston (run mode)
  stderr?: string; // compiler output (CE) or program stderr (RE)
  message?: string; // error / info text
  passed?: number; // submit: tests passed before failure
  total?: number; // submit: total tests
  failedOn?: number; // submit: 1-based failing test index
} | null;

interface Submission {
  id: number;
  language: string;
  status: Verdict;
  clock: string;
  detail: string;
}

export default function ArenaWorkspace({
  slug,
  problem,
  sampleInput,
  sampleOutput,
  practice = false,
}: {
  slug: string;
  problem: ReactNode;
  sampleInput: string;
  sampleOutput: string;
  /** Past-problem practice mode: no proctoring, no ranked board or points. */
  practice?: boolean;
}) {
  const codeKey = (lang: LanguageId) => `cp-arena:code:${slug}:${lang}`;
  const loadCode = (lang: LanguageId) => {
    if (typeof window === "undefined") return STARTER_CODE[lang];
    try {
      return localStorage.getItem(codeKey(lang)) ?? STARTER_CODE[lang];
    } catch {
      return STARTER_CODE[lang];
    }
  };

  const user = useUser();
  const [language, setLanguage] = useState<LanguageId>("cpp");
  const [code, setCode] = useState<string>(() => loadCode("cpp"));
  const [customInput, setCustomInput] = useState(sampleInput);
  const [running, setRunning] = useState(false);
  const [judgement, setJudgement] = useState<Judgement>(null);
  const [history, setHistory] = useState<Submission[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [mySolveSeconds, setMySolveSeconds] = useState<number | null>(null);
  const [myFlags, setMyFlags] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [myFlaggedSolve, setMyFlaggedSolve] = useState(false);
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const [pageFocused, setPageFocused] = useState(true);
  const [busyLabel, setBusyLabel] = useState("Running…");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  const startRef = useRef<number | null>(null);
  const frozenRef = useRef(false);

  // Live "your time" clock. Freezes the moment an accepted solution lands.
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      if (!frozenRef.current && startRef.current != null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const solved = mySolveSeconds != null;
  // No proctoring on practice (past) problems — they aren't ranked.
  const integrity = useIntegrityMonitor(!solved && !practice);

  // Live today leaderboard from the DB (refetched after an accepted submit).
  const fetchBoardRows = useCallback(async (): Promise<LeaderRow[]> => {
    try {
      const res = await fetch("/api/leaderboard?scope=today");
      const data = await res.json();
      return (data.rows ?? []) as LeaderRow[];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (practice) return; // practice pages don't show the ranked today board
    fetchBoardRows().then((rows) => setBoard(rows));
  }, [fetchBoardRows, practice]);

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

  // Autosave the draft per problem + language so a refresh doesn't lose work.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(`cp-arena:code:${slug}:${language}`, code);
      } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [code, language, slug]);

  const changeLanguage = (next: LanguageId) => {
    // Persist the current draft before swapping so switching never loses work.
    try {
      localStorage.setItem(`cp-arena:code:${slug}:${language}`, code);
    } catch {}
    setCode(loadCode(next));
    setLanguage(next);
  };

  const resetCode = () => {
    setCode(STARTER_CODE[language]);
    try {
      localStorage.removeItem(codeKey(language));
    } catch {}
  };

  const run = async () => {
    if (running) return;
    setRunning(true);
    setBusyLabel("Running your code…");
    setJudgement(null);
    const custom =
      customInput.trim() !== "" && customInput.trim() !== sampleInput.trim();
    const stdin = custom ? customInput : sampleInput;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin, slug }),
      });
      const data = await res.json();
      if (!data.ok) {
        setJudgement({
          mode: "run",
          status: "ERR",
          input: stdin,
          message: data.error ?? "Run failed.",
        });
      } else if (data.compileFailed) {
        setJudgement({
          mode: "run",
          status: "CE",
          input: stdin,
          stderr: data.compileStderr,
        });
      } else if (data.timedOut) {
        setJudgement({
          mode: "run",
          status: "TLE",
          input: stdin,
          output: data.stdout,
          message: `Exceeded the ${(data.timeLimitMs / 1000).toFixed(1)}s time limit.`,
        });
      } else if (custom) {
        setJudgement({
          mode: "run",
          status: "RAN",
          input: stdin,
          output: data.stdout,
          stderr: data.stderr,
        });
      } else {
        const pass = (data.stdout ?? "").trim() === sampleOutput.trim();
        setJudgement({
          mode: "run",
          status: pass ? "AC" : "WA",
          input: stdin,
          output: data.stdout,
          stderr: data.stderr,
        });
      }
    } catch {
      setJudgement({
        mode: "run",
        status: "ERR",
        input: stdin,
        message: "Could not reach the judge.",
      });
    } finally {
      setRunning(false);
    }
  };

  const addHistory = (status: Verdict, clock: string, detail: string) =>
    setHistory((h) => [
      { id: h.length + 1, language: languageLabel(language), status, clock, detail },
      ...h,
    ]);

  const submit = async () => {
    if (running || solved || !user) return;
    if (turnstileConfigured && !turnstileToken) {
      setJudgement({
        mode: "submit",
        status: "ERR",
        message: "Please complete the verification challenge, then submit.",
      });
      return;
    }
    setRunning(true);
    setBusyLabel("Judging against the hidden tests…");
    setJudgement(null);
    const solveSecs = elapsed;
    const flagsNow = integrity.total;
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          language,
          code,
          elapsedSeconds: solveSecs,
          flags: flagsNow,
          flagsBreakdown: integrity.counts,
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (res.status === 429 || data.rateLimited) {
        setJudgement({
          mode: "submit",
          status: "ERR",
          message: data.error ?? "Too many submissions — slow down a moment.",
        });
        return;
      }
      if (res.status === 401 || data.needsAuth) {
        setJudgement({
          mode: "submit",
          status: "ERR",
          message: "Your session expired — please log in again to submit.",
        });
        return;
      }
      if (res.status === 403 || data.needsVerify) {
        setJudgement({
          mode: "submit",
          status: "ERR",
          message:
            "Verify your email before submitting — open the verification page from your profile.",
        });
        return;
      }
      if (!data.ok) {
        setJudgement({
          mode: "submit",
          status: "ERR",
          message: data.error ?? "Judge error.",
        });
        return;
      }

      const verdict = data.verdict as Verdict;
      if (verdict === "AC") {
        frozenRef.current = true;
        setMySolveSeconds(solveSecs);
        setMyFlags(flagsNow);
        setJudgement({ mode: "submit", status: "AC", total: data.total });

        if (practice || data.practice) {
          // Past problem: judged for feedback, but no rank/points/board.
          addHistory("AC", formatClock(solveSecs), "Practice");
        } else {
          // The server now owns the standings — read our real rank/points back.
          const rows = await fetchBoardRows();
          setBoard(rows);
          const me = rows.find((r) => r.username === user.username);
          const rank = me?.rank ?? null;
          const points = me?.points ?? (flagsNow > FLAG_LIMIT ? BASE_POINTS : null);
          const flagged = me?.flagged ?? flagsNow > FLAG_LIMIT;
          setMyRank(rank);
          setMyPoints(points);
          setMyFlaggedSolve(flagged);

          const detail = flagged
            ? `Flagged · +${points ?? BASE_POINTS} pts`
            : rank
              ? `${ordinal(rank)} · +${points} pts`
              : `+${points ?? 0} pts`;
          addHistory("AC", formatClock(solveSecs), detail);
        }
      } else {
        setJudgement({
          mode: "submit",
          status: verdict,
          stderr: data.detail,
          passed: data.passed,
          total: data.total,
          failedOn: data.failedOn,
        });
        const detail =
          verdict === "CE"
            ? "Compilation error"
            : `on test ${data.failedOn ?? "?"}/${data.total ?? "?"}`;
        addHistory(verdict, formatClock(solveSecs), detail);
      }
    } catch {
      setJudgement({
        mode: "submit",
        status: "ERR",
        message: "Could not reach the judge.",
      });
    } finally {
      setRunning(false);
      // Turnstile tokens are single-use — refresh the widget for a next attempt.
      if (turnstileConfigured) {
        setTurnstileToken(null);
        setTurnstileNonce((n) => n + 1);
      }
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Problem statement */}
        <MechaPanel label={practice ? "Practice" : "Problem"} index="01" ticks>
          <div className="relative">
            <div
              // `data-lenis-prevent` lets this panel scroll natively instead of
              // Lenis hijacking the wheel for the whole page.
              data-lenis-prevent
              className={`arena-no-print max-h-[560px] overflow-y-auto overscroll-contain px-6 py-6 lg:max-h-[720px] ${
                practice ? "" : "select-none"
              }`}
              onCopyCapture={
                practice
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      integrity.record("copy");
                    }
              }
              onCutCapture={
                practice
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      integrity.record("cut");
                    }
              }
              onContextMenu={
                practice
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      integrity.record("context-menu");
                    }
              }
            >
              {problem}
            </div>
            {!practice && (
              <Watermark tag={`@${user?.username ?? "guest"} · PESUECC Arena`} />
            )}
            {!practice && !pageFocused && <ScreenGuard />}
          </div>
        </MechaPanel>

        {/* Editor + console */}
        <section className="space-y-4">
          <MechaPanel className="mecha--ide">
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
                {practice ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--ide-ink-dim)]">
                    <TerminalIcon />
                    <span className="hidden sm:inline">Practice</span>
                  </span>
                ) : (
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
                )}
              </div>
            </div>

            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              lockClipboard
              onBlocked={integrity.record}
            />

            {turnstileConfigured && !solved && (
              <div className="border-t border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-3">
                <Turnstile key={turnstileNonce} onToken={setTurnstileToken} />
              </div>
            )}

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
              <span
                title="Your code is auto-saved in this browser."
                className="hidden items-center gap-1.5 font-mono text-[11px] text-[var(--ide-ink-dim)] sm:inline-flex"
              >
                <CheckIcon />
                Auto-saved
              </span>
              <div className="ml-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={run}
                  disabled={running}
                  className="mecha-btn mecha-btn--ghost mecha-btn--sm"
                >
                  <PlayIcon />
                  Run
                </button>
                {user === null ? (
                  <Link
                    href="/login"
                    className="mecha-btn mecha-btn--solid mecha-btn--sm"
                  >
                    <BoltIcon />
                    Log in to submit
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={running || solved || user === undefined}
                    className={`mecha-btn mecha-btn--sm ${
                      solved ? "mecha-btn--ok" : "mecha-btn--solid"
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
                )}
              </div>
            </div>
          </MechaPanel>

          <CustomInputPanel
            value={customInput}
            onChange={setCustomInput}
            onResetToSample={() => setCustomInput(sampleInput)}
            isCustom={
              customInput.trim() !== "" &&
              customInput.trim() !== sampleInput.trim()
            }
          />

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
            busyLabel={busyLabel}
            judgement={judgement}
            sampleOutput={sampleOutput}
            myRank={myRank}
            myPoints={myPoints}
            flagged={myFlaggedSolve}
            flagCount={myFlags}
            practice={practice}
            solveClock={mySolveSeconds != null ? formatClock(mySolveSeconds) : ""}
          />

          <SubmissionsPanel history={history} />
        </section>
      </div>

      {practice ? (
        <MechaPanel label="Practice">
          <div className="px-6 pb-6 pt-3 text-center">
            <p className="text-sm text-charcoal/70">
              This is a past problem, open for practice. Submissions are judged
              against the hidden tests but don&apos;t affect the leaderboard.
            </p>
            <Link
              href="/cp-arena"
              className="mt-3 inline-block text-sm font-semibold text-bronze hover:underline"
            >
              Go to today&apos;s Problem of the Day →
            </Link>
          </div>
        </MechaPanel>
      ) : (
        <>
          <SpeedBounty />

          <MechaPanel label="Live Standings" ticks>
            <div className="flex items-center justify-end border-b border-hairline px-6 py-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal/60">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {board?.length ?? 0} solved today
              </span>
            </div>
            {board === null ? (
              <p className="px-6 py-8 text-center text-sm text-charcoal/50">
                Loading…
              </p>
            ) : (
              <LeaderboardTable
                rows={board}
                scope="today"
                currentUsername={user?.username}
              />
            )}
          </MechaPanel>
        </>
      )}
    </div>
  );
}

/* --- Console --- */

function Console({
  running,
  busyLabel,
  judgement,
  sampleOutput,
  myRank,
  myPoints,
  flagged,
  flagCount,
  practice,
  solveClock,
}: {
  running: boolean;
  busyLabel: string;
  judgement: Judgement;
  sampleOutput: string;
  myRank: number | null;
  myPoints: number | null;
  flagged: boolean;
  flagCount: number;
  practice: boolean;
  solveClock: string;
}) {
  return (
    <MechaPanel
      className="mecha--ide"
      label="Console"
      index={<VerdictBadge running={running} judgement={judgement} />}
    >
      <div className="min-h-[150px] px-4 py-4 font-mono text-xs leading-relaxed text-[var(--ide-code)]">
        {running ? (
          <p className="flex items-center gap-2 text-bronze">
            <span className="h-2 w-2 animate-pulse rounded-full bg-bronze" />
            {busyLabel}
          </p>
        ) : !judgement ? (
          <p className="text-[var(--ide-ink-dim)]">
            Write your solution, then{" "}
            <span className="text-bronze">Run</span> it against the sample or{" "}
            <span className="text-bronze">Submit </span> to the judge&apos;s hidden
            tests.{" "}
            {practice
              ? "This past problem is for practice — it won't change the leaderboard."
              : "Faster accepted solves earn more of the daily bounty."}
          </p>
        ) : judgement.mode === "submit" ? (
          <SubmitResult
            judgement={judgement}
            myRank={myRank}
            myPoints={myPoints}
            flagged={flagged}
            flagCount={flagCount}
            practice={practice}
            solveClock={solveClock}
          />
        ) : (
          <RunResult judgement={judgement} sampleOutput={sampleOutput} />
        )}
      </div>
    </MechaPanel>
  );
}

function SubmitResult({
  judgement,
  myRank,
  myPoints,
  flagged,
  flagCount,
  practice,
  solveClock,
}: {
  judgement: NonNullable<Judgement>;
  myRank: number | null;
  myPoints: number | null;
  flagged: boolean;
  flagCount: number;
  practice: boolean;
  solveClock: string;
}) {
  if (judgement.status === "AC" && practice) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Accepted — all {judgement.total ?? ""} tests passed.
        </p>
        <p className="text-[var(--ide-code)]">
          Practice solve in{" "}
          <span className="font-semibold text-[var(--ide-ink-strong)]">
            {solveClock}
          </span>
          . Past problems don&apos;t affect the leaderboard — nice work.
        </p>
      </div>
    );
  }

  if (judgement.status === "AC") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Accepted — all {judgement.total ?? ""} tests passed.
        </p>
        {flagged ? (
          <>
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
          </>
        ) : (
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
        )}
      </div>
    );
  }

  if (judgement.status === "ERR") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Couldn&apos;t judge your submission.
        </p>
        <p className="text-[var(--ide-code)]">{judgement.message}</p>
      </div>
    );
  }

  if (judgement.status === "CE") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Compilation error.
        </p>
        <IoBlock label="Compiler" value={judgement.stderr || "—"} tone="bad" />
      </div>
    );
  }

  // WA / TLE / MLE / RE — never reveal the hidden test data, only which one failed.
  const heading =
    judgement.status === "WA"
      ? "Wrong Answer"
      : judgement.status === "TLE"
        ? "Time Limit Exceeded"
        : judgement.status === "MLE"
          ? "Memory Limit Exceeded"
          : "Runtime Error";
  const tone =
    judgement.status === "TLE" || judgement.status === "MLE"
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  return (
    <div className="space-y-2">
      <p className={`text-sm font-semibold ${tone}`}>{heading}</p>
      <p className="text-[var(--ide-code)]">
        Failed on test{" "}
        <span className="font-semibold text-[var(--ide-ink-strong)]">
          {judgement.failedOn ?? "?"}
        </span>{" "}
        of {judgement.total ?? "?"} · {judgement.passed ?? 0} passed.
      </p>
      {judgement.status === "RE" && judgement.stderr ? (
        <IoBlock label="Stderr" value={judgement.stderr} tone="bad" />
      ) : null}
    </div>
  );
}

function RunResult({
  judgement,
  sampleOutput,
}: {
  judgement: NonNullable<Judgement>;
  sampleOutput: string;
}) {
  if (judgement.status === "ERR") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Couldn&apos;t run your code.
        </p>
        <p className="text-[var(--ide-code)]">{judgement.message}</p>
      </div>
    );
  }
  if (judgement.status === "CE") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Compilation error.
        </p>
        <IoBlock label="Compiler" value={judgement.stderr || "—"} tone="bad" />
      </div>
    );
  }
  if (judgement.status === "TLE") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
          Time Limit Exceeded.
        </p>
        <p className="text-[var(--ide-code)]">{judgement.message}</p>
      </div>
    );
  }
  if (judgement.status === "RAN") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--ide-ink-strong)]">
          Ran on your custom input.
        </p>
        <IoBlock label="Input" value={judgement.input ?? ""} />
        <IoBlock label="Output" value={judgement.output || "(no output)"} />
        {judgement.stderr ? (
          <IoBlock label="Stderr" value={judgement.stderr} tone="bad" />
        ) : null}
      </div>
    );
  }
  // AC / WA against the visible sample case.
  return (
    <div className="space-y-3">
      {judgement.status === "WA" && (
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Wrong Answer on sample case.
        </p>
      )}
      <IoBlock label="Input" value={judgement.input ?? ""} />
      <IoBlock label="Expected" value={sampleOutput} />
      <IoBlock
        label="Your output"
        value={judgement.output ?? "—"}
        tone={judgement.status === "AC" ? "ok" : "bad"}
      />
      {judgement.stderr ? (
        <IoBlock label="Stderr" value={judgement.stderr} tone="bad" />
      ) : null}
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
      <span className="mecha-chip bg-bronze/20 text-bronze">Running…</span>
    );
  }
  if (!judgement) return null;
  const red = "bg-red-500/15 text-red-600 dark:text-red-400";
  const amber = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  const map = {
    AC: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    WA: red,
    RAN: "bg-bronze/15 text-bronze",
    CE: red,
    TLE: amber,
    MLE: amber,
    RE: red,
    ERR: red,
  } as const;
  const labels = {
    AC: "Accepted",
    WA: "Wrong Answer",
    RAN: "Ran",
    CE: "Compile Error",
    TLE: "Time Limit Exceeded",
    MLE: "Memory Limit Exceeded",
    RE: "Runtime Error",
    ERR: "Error",
  } as const;
  return (
    <span className={`mecha-chip ${map[judgement.status]}`}>
      {labels[judgement.status]}
    </span>
  );
}

/* --- Custom input --- */

function CustomInputPanel({
  value,
  onChange,
  onResetToSample,
  isCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  onResetToSample: () => void;
  isCustom: boolean;
}) {
  return (
    <MechaPanel>
      <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-bronze">
          <TerminalIcon />
        </span>
        <span className="text-sm font-semibold text-chocolate">
          Custom input
        </span>
        {isCustom ? (
          <span className="mecha-chip bg-bronze/15 text-bronze">custom</span>
        ) : (
          <span className="text-xs text-charcoal/45">using sample</span>
        )}
        <ChevronIcon className="ml-auto text-charcoal/40 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-hairline p-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={4}
          placeholder="Enter stdin to Run against…"
          className="w-full resize-y rounded-lg border border-[var(--ide-border)] bg-[var(--ide-body)] px-3 py-2 font-mono text-xs text-[var(--ide-ink-strong)] outline-none focus:border-bronze"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-charcoal/50">
            Run uses this input. Submit always judges the hidden tests.
          </p>
          <button
            type="button"
            onClick={onResetToSample}
            className="shrink-0 text-[11px] font-medium text-bronze hover:underline"
          >
            Reset to sample
          </button>
        </div>
      </div>
      </details>
    </MechaPanel>
  );
}

/* --- Submission history --- */

function SubmissionsPanel({ history }: { history: Submission[] }) {
  return (
    <MechaPanel>
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h3 className="font-display text-sm font-bold text-chocolate">
          Your submissions
        </h3>
        <span className="font-mono text-[11px] text-charcoal/45">
          {history.length} this session
        </span>
      </div>
      {history.length === 0 ? (
        <p className="px-4 py-5 text-xs text-charcoal/50">
          No submissions yet — hit Submit to send your solution to the judge.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {history.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span
                className={`mecha-chip ${
                  s.status === "AC"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                }`}
              >
                {s.status}
              </span>
              <span className="font-mono text-xs text-charcoal/60">
                {s.language}
              </span>
              <span className="font-mono text-xs text-charcoal/45">
                {s.clock}
              </span>
              <span className="ml-auto text-right text-xs font-medium text-charcoal/70">
                {s.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </MechaPanel>
  );
}

/* --- Speed bounty ladder --- */

function SpeedBounty() {
  const medal = ["#d9a441", "#b9b4ad", "#c08457"];
  return (
    <MechaPanel label="Speed Bounty" ticks>
      <div className="px-6 pb-6 pt-3">
        <p className="text-xs text-charcoal/60">
          Points by finish order — the faster you get accepted, the more you earn.
        </p>
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
      </div>
    </MechaPanel>
  );
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

function TerminalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
