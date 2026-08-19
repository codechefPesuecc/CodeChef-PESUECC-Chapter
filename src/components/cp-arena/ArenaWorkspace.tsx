"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import CodeEditor from "./CodeEditor";
import ArenaRules from "./ArenaRules";
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


// Draggable split between the problem and the editor (desktop only). Stored as
// the problem pane's width in percent; clamped so neither side collapses.
const SPLIT_KEY = "cp-arena:split-pct";
const SPLIT_MIN = 20;
const SPLIT_MAX = 80;
const SPLIT_STEP = 2; // keyboard nudge per arrow press
const clampSplit = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));

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
  warning?: string; // soft warning (e.g. persist failure on an AC)
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
  // Layout: draggable problem/editor split + maximized editor.
  const [splitPct, setSplitPct] = useState(50);
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const [splitHeightPct, setSplitHeightPct] = useState(70);
  const [bottomTab, setBottomTab] = useState<"testcase" | "result">("testcase");
  const [leftTab, setLeftTab] = useState<"problem" | "rules" | "submissions">("problem");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const startRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Live "your time" clock. Seeded to now, then corrected to the server-recorded
  // first-open time (below) so it survives reloads. Freezes on an accepted solve.
  useEffect(() => {
    if (startRef.current == null) startRef.current = Date.now();
    const id = setInterval(() => {
      if (!frozenRef.current && startRef.current != null) {
        setElapsed(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Ranked POTD: record the first-open time (server-authoritative and immutable)
  // and seed the clock from it, so "your time" reads the same after a refresh or
  // on another device. Practice problems keep the local-only timer above.
  useEffect(() => {
    if (practice || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/attempt/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const data = await res.json();
        if (!cancelled && data?.ok && data.ranked && typeof data.startedAt === "number") {
          startRef.current = data.startedAt;
          if (!frozenRef.current) {
            setElapsed(Math.max(0, Math.floor((Date.now() - data.startedAt) / 1000)));
          }
        }
      } catch {
        // Best-effort — the local timer still ticks if the beacon fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practice, slug, user]);

  const solved = mySolveSeconds != null;
  // No proctoring on practice (past) problems — they aren't ranked.
  const integrity = useIntegrityMonitor(!solved && !practice, slug);

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

  // Restore the saved problem/editor split once on the client. Deferred to the
  // next frame so the first (hydration) paint still matches SSR at 50% — no
  // hydration mismatch on the inline width — then it snaps to the stored value.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(SPLIT_KEY);
        const n = raw == null ? NaN : Number(raw);
        if (Number.isFinite(n)) setSplitPct(clampSplit(n));
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Persist the split (debounced) so it survives reloads.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(SPLIT_KEY, String(Math.round(splitPct)));
      } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [splitPct]);

  // Maximized editor: lock page scroll and let Escape exit. Purely a CSS overlay
  // (no Fullscreen API), so it never blurs the window and can't trip the
  // integrity monitor's tab-switch/screenshot flags.
  useEffect(() => {
    if (!editorFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditorFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [editorFullscreen]);

  // Drag the divider: translate the cursor's x within the row into a width %.
  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault();
    const applyFromClientX = (clientX: number) => {
      const el = splitContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      setSplitPct(clampSplit(((clientX - rect.left) / rect.width) * 100));
    };
    const onMove = (ev: PointerEvent) => applyFromClientX(ev.clientX);
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const onResizeKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSplitPct((p) => clampSplit(p - SPLIT_STEP));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSplitPct((p) => clampSplit(p + SPLIT_STEP));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSplitPct(50);
    }
  };

  const rightPaneRef = useRef<HTMLDivElement>(null);
  const startVerticalResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const applyFromClientY = (clientY: number) => {
      const el = rightPaneRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      let pct = ((clientY - rect.top) / rect.height) * 100;
      pct = Math.min(80, Math.max(20, pct));
      setSplitHeightPct(pct);
    };
    const onMove = (ev: PointerEvent) => applyFromClientY(ev.clientY);
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
  };

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
        // Prefer the server's authoritative solve time (submit − first-open);
        // fall back to the local stopwatch only if it's somehow absent.
        const official =
          typeof data.elapsedSeconds === "number" ? data.elapsedSeconds : solveSecs;
        frozenRef.current = true;
        setMySolveSeconds(official);
        setMyFlags(flagsNow);
        setJudgement({ mode: "submit", status: "AC", total: data.total });

        if (practice || data.practice) {
          // Past problem: judged for feedback, but no rank/points/board.
          addHistory("AC", formatClock(official), "Practice");
        } else {
          // Prefer the server-computed rank/points (immune to read-after-write lag).
          let rank: number | null = data.rank ?? null;
          let points: number | null = data.points ?? null;
          let flagged: boolean = data.flagged ?? flagsNow > FLAG_LIMIT;

          // Still refresh the board for display, but don't use it for self-identity
          // unless the server didn't return rank/points (older API or compute failure).
          const rows = await fetchBoardRows();
          setBoard(rows);

          if (rank == null && points == null) {
            const me = rows.find((r) => r.display === (user.srn ?? user.prn));
            rank = me?.rank ?? null;
            points = me?.points ?? (flagsNow > FLAG_LIMIT ? BASE_POINTS : null);
            flagged = me?.flagged ?? flagsNow > FLAG_LIMIT;
          }

          setMyRank(rank);
          setMyPoints(points);
          setMyFlaggedSolve(flagged);

          // Surface a soft warning if the server recorded the AC verdict but
          // failed to persist the submission row (leaderboard won't reflect it).
          if (data.persistFailed) {
            setJudgement({
              mode: "submit",
              status: "AC",
              total: data.total,
              warning:
                "Accepted, but recording to the leaderboard failed. Try re-submitting or contact staff.",
            });
          }

          const detail = flagged
            ? `Flagged · +${points ?? BASE_POINTS} pts`
            : rank
              ? `${ordinal(rank)} · +${points} pts`
              : `+${points ?? 0} pts`;
          addHistory("AC", formatClock(official), detail);
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

  const fullscreenBackdrop =
    editorFullscreen &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        aria-hidden
        onClick={() => setEditorFullscreen(false)}
        className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm"
      />,
      document.body,
    );

  return (
    <>
      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #403831; /* Subtle dark bronze/brown */
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #d49942; /* Bronze highlight */
        }
      `}</style>
      {fullscreenBackdrop}
      <div
        ref={splitContainerRef}
        className={
          editorFullscreen
            ? "fixed inset-4 z-[100] rounded-xl bg-[var(--color-panel)] shadow-2xl dark:bg-[#1c1714] flex flex-row items-start gap-3"
            : "absolute inset-0 flex flex-col gap-3 lg:flex-row lg:items-start"
        }
        style={{ "--arena-left": `${splitPct}%` } as React.CSSProperties}
      >
        {/* ────────── LEFT PANE (Problem Statement / Rules / Submissions) ────────── */}
        <div className={`flex flex-col min-h-0 relative h-full w-full lg:w-[var(--arena-left)] lg:shrink-0 ${editorFullscreen ? "hidden lg:flex" : ""}`}>
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0">
              <MechaPanel
                className="h-full"
                bodyClassName="flex flex-col h-full"
              >
                <div className="flex shrink-0 items-center gap-4 border-b border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 h-12">
                  <button
                    type="button"
                    onClick={() => setLeftTab("problem")}
                    className={`mecha-btn inline-flex h-8 items-center justify-center rounded border px-3 font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                      leftTab === "problem" 
                        ? "border-bronze bg-bronze text-[#1c1714] shadow-[0_0_12px_rgba(212,153,66,0.6)] scale-[1.02]" 
                        : "border-transparent bg-[var(--ide-border)] text-[var(--ide-ink-dim)] hover:border-bronze/50 hover:bg-[#d49942]/20 hover:text-bronze hover:shadow-[0_0_8px_rgba(212,153,66,0.4)]"
                    }`}
                  >
                    Description
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab("rules")}
                    className={`mecha-btn inline-flex h-8 items-center justify-center rounded border px-3 font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                      leftTab === "rules" 
                        ? "border-bronze bg-bronze text-[#1c1714] shadow-[0_0_12px_rgba(212,153,66,0.6)] scale-[1.02]" 
                        : "border-transparent bg-[var(--ide-border)] text-[var(--ide-ink-dim)] hover:border-bronze/50 hover:bg-[#d49942]/20 hover:text-bronze hover:shadow-[0_0_8px_rgba(212,153,66,0.4)]"
                    }`}
                  >
                    Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab("submissions")}
                    className={`mecha-btn inline-flex h-8 items-center justify-center rounded border px-3 font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                      leftTab === "submissions" 
                        ? "border-bronze bg-bronze text-[#1c1714] shadow-[0_0_12px_rgba(212,153,66,0.6)] scale-[1.02]" 
                        : "border-transparent bg-[var(--ide-border)] text-[var(--ide-ink-dim)] hover:border-bronze/50 hover:bg-[#d49942]/20 hover:text-bronze hover:shadow-[0_0_8px_rgba(212,153,66,0.4)]"
                    }`}
                  >
                    Submissions
                  </button>
                  
                  {/* Practice / Arena mode indicator that used to be the MechaPanel label */}
                  <div className="ml-auto flex items-center gap-2">
                    <span className="mecha-chip bg-bronze/10 text-bronze">{practice ? "PRACTICE" : "ARENA"}</span>
                  </div>
                </div>
                
                <div className="flex-1 min-h-0 relative">
                {leftTab === "problem" && (
                  <div className="relative h-full">
                    <div
                      data-lenis-prevent
                      className={`arena-no-print h-full overflow-y-auto px-6 py-6 ${practice ? "" : "select-none"}`}
                      onCopyCapture={practice ? undefined : (e) => { e.preventDefault(); integrity.record("copy"); }}
                      onCutCapture={practice ? undefined : (e) => { e.preventDefault(); integrity.record("cut"); }}
                      onContextMenu={practice ? undefined : (e) => { e.preventDefault(); integrity.record("context-menu"); }}
                    >
                      {problem}
                    </div>
                    {!practice && <Watermark tag={`@${user?.username ?? "guest"} · PESUECC Arena`} />}
                    {!practice && !pageFocused && <ScreenGuard />}
                  </div>
                )}
                {leftTab === "rules" && (
                  <div className="h-full overflow-y-auto px-4 py-4 space-y-6" data-lenis-prevent>
                    <SpeedBounty />
                    <ArenaRules defaultOpen noPanel />
                  </div>
                )}
                {leftTab === "submissions" && (
                  <div className="h-full overflow-y-auto" data-lenis-prevent>
                    <SubmissionsPanel history={history} />
                  </div>
                )}
                </div>
              </MechaPanel>
            </div>
          </div>
        </div>

        {/* ────────── HORIZONTAL DIVIDER ────────── */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the problem and editor panels"
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          aria-valuenow={Math.round(splitPct)}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={onResizeKey}
          onDoubleClick={() => setSplitPct(50)}
          title="Drag to resize · double-click to reset"
          className="group relative hidden w-1 shrink-0 cursor-col-resize touch-none select-none self-stretch lg:flex items-center justify-center transition-colors z-10"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-transparent group-hover:bg-[#d49942] transition-colors duration-200" />
          <div className="h-8 w-[2px] rounded-full bg-[#403831] group-hover:bg-[#d49942] transition-colors duration-200" />
        </div>

        {/* ────────── RIGHT PANE (Editor + Test Cases) ────────── */}
        <section ref={rightPaneRef} className="flex flex-col h-full w-full lg:min-w-0 lg:flex-1">
          {/* ── TOP: Code Editor ── */}
          <div className="min-h-0 flex flex-col relative" style={{ flex: `${splitHeightPct} 1 0%` }}>

            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0">
                <MechaPanel
                  className="mecha--ide h-full"
                  bodyClassName="flex flex-col h-full overflow-hidden"
                >
                  <div className="flex shrink-0 items-center gap-3 border-b border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 h-12">
                    <button
                      type="button"
                      onClick={() => setEditorFullscreen((prev) => !prev)}
                      title={editorFullscreen ? "Exit full screen" : "Full screen"}
                      className="hidden text-[var(--ide-ink-dim)] transition-colors hover:text-[var(--ide-ink)] lg:block shrink-0"
                    >
                      {editorFullscreen ? <CompressIcon /> : <ExpandIcon />}
                    </button>
                    
                    <div className="flex items-center gap-2 px-2 text-[12px] font-bold tracking-wider text-[var(--ide-ink)] uppercase">
                      Code
                    </div>

                    {!practice && integrity.total > 0 && (
                      <div
                        role="status"
                        className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium ${
                          integrity.flagged
                            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <ShieldIcon />
                        <span className="hidden sm:inline">
                          {integrity.notice ??
                            (integrity.flagged
                              ? "Removed from today's top 10 — an accepted solve now earns only the 100-point base."
                              : "Stay under 5 flags to keep your top-10 bounty eligibility.")}
                        </span>
                        <span className="ml-1 shrink-0 font-mono">
                          {integrity.total}/{FLAG_LIMIT}
                        </span>
                      </div>
                    )}

                    <div className="ml-auto flex items-center gap-3 shrink-0">
                      <label className="sr-only" htmlFor="language">Language</label>
                      <select
                        id="language"
                        value={language}
                        onChange={(e) => changeLanguage(e.target.value as LanguageId)}
                        className="h-7 cursor-pointer appearance-none rounded bg-[var(--ide-border)] py-0 pl-3 pr-7 font-mono text-[11px] font-bold text-[var(--ide-ink)] outline-none hover:bg-bronze hover:text-[#1c1714] transition-colors"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M3%205l3%203%203-3%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 6px center",
                        }}
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.id} value={lang.id} className="bg-[var(--ide-bar)] text-chocolate dark:text-cream">
                            {lang.label}
                          </option>
                        ))}
                      </select>

                      <span
                        title={practice ? "Practice timer (local only)" : "Indicative timer"}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--ide-ink)]"
                      >
                        <ClockIcon />
                        {formatClock(elapsed)}
                      </span>

                      {!practice && (
                        <span
                          title="Your penalty flags. Each failed submit adds 1 flag."
                          className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${
                            integrity.total >= FLAG_LIMIT ? "text-red-500/80" : "text-[var(--ide-ink-dim)]"
                          }`}
                        >
                          🚩 {integrity.total}
                        </span>
                      )}


                    </div>
                  </div>

                  <div className="relative flex-1 min-h-0 bg-[var(--ide-bg)] rounded-xl border border-[var(--ide-border)] overflow-hidden">
                    {showResetConfirm && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] p-6 shadow-2xl max-w-sm w-full mx-4">
                          <h3 className="text-lg font-bold text-[var(--ide-ink)] mb-2">Reset Code?</h3>
                          <p className="text-sm text-[var(--ide-ink-dim)] mb-6">
                            This will permanently overwrite your current draft with the starter code. This action cannot be undone.
                          </p>
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => setShowResetConfirm(false)}
                              className="px-4 py-2 rounded text-sm font-medium text-[var(--ide-ink)] hover:bg-[var(--ide-border)] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                setCode(STARTER_CODE[language]);
                                setShowResetConfirm(false);
                              }}
                              className="px-4 py-2 rounded text-sm font-medium bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 p-3" data-lenis-prevent>
                      <CodeEditor
                        value={code}
                        onChange={setCode}
                        language={language}
                        lockClipboard
                        onBlocked={integrity.record}
                        fullscreen
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-3">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowResetConfirm(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--ide-ink-dim)] transition-colors hover:text-[var(--ide-ink)]"
                      >
                        <ResetIcon />
                        Reset
                      </button>
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--ide-ink-dim)]">
                        <CheckIcon /> Auto-saved
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={run}
                        disabled={running}
                        className="mecha-btn group inline-flex h-8 items-center gap-2 rounded bg-transparent px-4 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--ide-ink)] hover:bg-[var(--ide-border)] hover:text-white dark:hover:text-black"
                      >
                        <PlayIcon />
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={submit}
                        disabled={running || (turnstileConfigured && !solved && !turnstileToken)}
                        className="mecha-btn group inline-flex h-8 items-center gap-2 rounded bg-bronze px-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#1c1714] shadow hover:bg-[#d49942] focus-visible:ring-2 focus-visible:ring-bronze disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <BoltIcon />
                        Submit
                      </button>
                    </div>
                  </div>
                </MechaPanel>
              </div>
            </div>
          </div>

          {/* ── VERTICAL DIVIDER ── */}
          <div
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={startVerticalResize}
            onDoubleClick={() => setSplitHeightPct(70)}
            title="Drag to resize · double-click to reset"
            className="group relative hidden h-2 shrink-0 cursor-row-resize touch-none select-none lg:flex items-center justify-center transition-colors my-1 z-10 w-full"
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-transparent group-hover:bg-[#d49942] transition-colors duration-200" />
            <div className="w-8 h-[2px] rounded-full bg-[#403831] group-hover:bg-[#d49942] transition-colors duration-200" />
          </div>

          {/* ── BOTTOM: Test Cases & Result ── */}
          <div className="flex flex-col min-h-0 relative" style={{ flex: `${100 - splitHeightPct} 1 0%` }}>
            <div className="mecha-tabs mb-1.5 shrink-0 flex w-full bg-[var(--ide-bar)] rounded-lg border border-[var(--ide-border)] px-2 pt-1">
              <button
                type="button"
                onClick={() => setBottomTab("testcase")}
                className={`mecha-tab ${bottomTab === "testcase" ? "mecha-tab--active" : ""}`}
              >
                Testcase
              </button>
              <button
                type="button"
                onClick={() => setBottomTab("result")}
                className={`mecha-tab ${bottomTab === "result" ? "mecha-tab--active" : ""}`}
              >
                Test Result
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden p-0" data-lenis-prevent>
                {bottomTab === "testcase" ? (
                  <CustomInputPanel
                    value={customInput}
                    onChange={setCustomInput}
                    onResetToSample={() => setCustomInput(sampleInput)}
                    isCustom={customInput.trim() !== "" && customInput.trim() !== sampleInput.trim()}
                  />
                ) : (
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
                )}



                {turnstileConfigured && !solved && (
                  <div className="shrink-0 border-t border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-3 mx-2 mb-2 rounded-lg">
                    <Turnstile key={turnstileNonce} onToken={setTurnstileToken} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
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
      className="mecha--ide h-full"
      bodyClassName="flex flex-col h-full"
      label="Console"
      index={<VerdictBadge running={running} judgement={judgement} />}
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 font-mono text-xs leading-relaxed text-[var(--ide-code)]">
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
        {judgement.warning && (
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            ⚠ {judgement.warning}
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
    <div className="flex flex-col flex-1 min-h-0 h-full rounded-xl border border-[var(--ide-border)] bg-[var(--ide-bg)] overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--ide-border)] bg-[var(--ide-bar)] px-4 py-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--ide-ink-dim)]">Custom Input</span>
        {isCustom ? (
          <span className="mecha-chip bg-bronze/15 text-bronze">custom</span>
        ) : (
          <span className="text-xs text-charcoal/45">using sample</span>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="Enter stdin to Run against…"
          className="mecha-input flex-1 min-h-0 py-2 font-mono text-xs resize-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-charcoal/50">
            Run uses this input. Submit always judges the hidden tests.
          </p>
          {isCustom && (
            <button
              onClick={onResetToSample}
              className="text-[11px] font-medium text-bronze hover:underline"
            >
              Reset to sample
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Submission history --- */

function SubmissionsPanel({ history }: { history: Submission[] }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3 shrink-0">
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
    </div>
  );
}

/* --- Speed bounty ladder --- */

function SpeedBounty() {
  const medal = ["#d9a441", "#b9b4ad", "#c08457"];
  return (
    <div className="px-2 pb-4 pt-2">
      <h3 className="font-display text-base font-bold text-chocolate mb-1">Speed Bounty</h3>
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
        {Array.from({ length: 400 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-wider text-black dark:text-white"
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="M14 10l7-7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

// Vertical grip dots for the resize divider.
function GripDotsIcon() {
  return (
    <svg width="8" height="20" viewBox="0 0 8 20" fill="currentColor" aria-hidden>
      <circle cx="4" cy="4" r="1.4" />
      <circle cx="4" cy="10" r="1.4" />
      <circle cx="4" cy="16" r="1.4" />
    </svg>
  );
}
