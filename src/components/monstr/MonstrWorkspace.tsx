"use client";

import { useEffect, useRef, useState } from "react";
import CodeEditor from "@/components/cp-arena/CodeEditor";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import MonstrProblem, { type MonstrProblemData } from "@/components/monstr/MonstrProblem";
import { LANGUAGES, STARTER_CODE, formatClock } from "@/components/cp-arena/mockData";
import type { LanguageId } from "@/components/cp-arena/mockData";

interface Props {
  contestId: string;
  startedAt: number | null;
  endsAt: number | null;
  serverNow?: number;
  problems: Array<{ id: string; title: string; orderIndex: number }>;
  allowedLanguages: LanguageId[];
  initialProblem: MonstrProblemData;
}

type RunResult = {
  ok: boolean;
  error?: string;
  stdout?: string;
  stderr?: string;
  compileStderr?: string;
  verdict?: string;
  message?: string;
};

// Resizable split, mirroring the CP Arena workspace.
const SPLIT_MIN = 28;
const SPLIT_MAX = 72;
const SPLIT_STEP = 4;
const SPLIT_KEY = "monstr:split-pct";
const clampSplit = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));

const VERDICT_STYLE: Record<string, string> = {
  AC: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  WA: "bg-red-500/15 text-red-600 dark:text-red-400",
  TLE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  MLE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  RE: "bg-red-500/15 text-red-600 dark:text-red-400",
  CE: "bg-red-500/15 text-red-600 dark:text-red-400",
  ERR: "bg-red-500/15 text-red-600 dark:text-red-400",
  RAN: "bg-bronze/15 text-bronze",
};
const VERDICT_LABEL: Record<string, string> = {
  AC: "Accepted",
  WA: "Wrong Answer",
  TLE: "Time Limit Exceeded",
  MLE: "Memory Limit Exceeded",
  RE: "Runtime Error",
  CE: "Compilation Error",
  ERR: "Error",
  RAN: "Ran",
};

export default function MonstrWorkspace({
  contestId,
  startedAt,
  endsAt,
  problems,
  allowedLanguages,
  initialProblem,
}: Props) {
  const [activeProblemId, setActiveProblemId] = useState(initialProblem.id);
  const [language, setLanguage] = useState<LanguageId>(allowedLanguages[0] || "cpp");
  const [code, setCode] = useState(STARTER_CODE[language] || "");
  const [customInput, setCustomInput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [consoleTab, setConsoleTab] = useState<"input" | "result">("input");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [contestStarted, setContestStarted] = useState(!!startedAt);
  const [serverEndsAt, setServerEndsAt] = useState(endsAt);
  const [problemCache, setProblemCache] = useState<Map<string, MonstrProblemData>>(
    new Map([[initialProblem.id, initialProblem]]),
  );
  const [splitPct, setSplitPct] = useState(50);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Restore the saved split once on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SPLIT_KEY);
      const n = raw == null ? NaN : Number(raw);
      if (Number.isFinite(n)) setSplitPct(clampSplit(n));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SPLIT_KEY, String(Math.round(splitPct)));
    } catch {}
  }, [splitPct]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = splitContainerRef.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      setSplitPct(clampSplit(((ev.clientX - rect.left) / rect.width) * 100));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "col-resize";
  };
  const onResizeKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setSplitPct((p) => clampSplit(p - SPLIT_STEP));
    else if (e.key === "ArrowRight") setSplitPct((p) => clampSplit(p + SPLIT_STEP));
  };

  // Countdown.
  useEffect(() => {
    if (!contestStarted || !serverEndsAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((serverEndsAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) setLoading(false);
    }, 250);
    return () => clearInterval(timer);
  }, [contestStarted, serverEndsAt]);

  // Poll for start + endsAt.
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/monstr/contests/${contestId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.startedAt && !contestStarted) setContestStarted(true);
          if (data.endsAt) setServerEndsAt(data.endsAt);
        }
      } catch {}
    };
    const timer = setInterval(poll, 10000);
    return () => clearInterval(timer);
  }, [contestId, contestStarted]);

  const loadProblem = async (problemId: string) => {
    if (problemCache.has(problemId)) return;
    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/problems/${problemId}`);
      if (res.ok) {
        const problem = (await res.json()) as MonstrProblemData;
        setProblemCache((prev) => new Map(prev).set(problemId, problem));
      }
    } catch {}
  };

  const handleProblemSwitch = (problemId: string) => {
    loadProblem(problemId);
    const stored = localStorage.getItem(`monstr:code:${contestId}:${problemId}:${language}`);
    setCode(stored || STARTER_CODE[language] || "");
    setActiveProblemId(problemId);
    setResult(null);
  };

  const handleLanguageSwitch = (newLang: LanguageId) => {
    setLanguage(newLang);
    const stored = localStorage.getItem(`monstr:code:${contestId}:${activeProblemId}:${newLang}`);
    setCode(stored || STARTER_CODE[newLang] || "");
  };

  useEffect(() => {
    localStorage.setItem(`monstr:code:${contestId}:${activeProblemId}:${language}`, code);
  }, [code, contestId, activeProblemId, language]);

  const handleRun = async () => {
    if (!contestStarted) return;
    setLoading(true);
    setResult(null);
    setConsoleTab("result");
    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: activeProblemId, language, code, stdin: customInput }),
      });
      const data = await res.json();
      setResult({ ...data, verdict: data.verdict ?? (data.ok ? "RAN" : "ERR") });
    } catch {
      setResult({ ok: false, error: "Run failed.", verdict: "ERR" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!contestStarted || countdown === 0) return;
    setLoading(true);
    setConsoleTab("result");
    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: activeProblemId, language, code }),
      });
      const data = await res.json();
      setResult(
        data.ok
          ? { ok: true, verdict: data.verdict, message: VERDICT_LABEL[data.verdict] ?? data.verdict }
          : { ...data, verdict: data.verdict ?? "ERR" },
      );
    } catch {
      setResult({ ok: false, error: "Submit failed.", verdict: "ERR" });
    } finally {
      setLoading(false);
    }
  };

  const currentProblem = problemCache.get(activeProblemId) || initialProblem;
  const activeIndex = problems.findIndex((p) => p.id === activeProblemId);
  const canSubmit = contestStarted && countdown > 0 && !loading;
  const ended = contestStarted && countdown === 0;
  const allowedLangOptions = LANGUAGES.filter((l) => allowedLanguages.includes(l.id));

  const tabBtn =
    "inline-flex h-8 items-center justify-center rounded border px-3 font-mono text-[11px] font-bold uppercase tracking-wider transition-all duration-200";
  const tabActive = "border-bronze bg-bronze text-[#1c1714] shadow-[0_0_10px_rgba(212,153,66,0.5)]";
  const tabIdle =
    "border-hairline bg-transparent text-charcoal/55 hover:border-bronze/50 hover:text-bronze";

  return (
    <div className="flex h-[100dvh] flex-col bg-cream/40 dark:bg-[#0f0b07]">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline bg-white/70 px-4 py-2.5 backdrop-blur dark:bg-panel/70">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-bronze">
            Monstr
          </span>
          <span
            className={`mecha-chip ${
              ended
                ? "bg-charcoal/10 text-charcoal/60"
                : contestStarted
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            }`}
          >
            {ended ? "Ended" : contestStarted ? "Live" : "Waiting"}
          </span>
        </div>

        {/* Problem switcher */}
        {contestStarted && problems.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {problems.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProblemSwitch(p.id)}
                title={p.title}
                className={`${tabBtn} ${activeProblemId === p.id ? tabActive : tabIdle}`}
              >
                P{idx + 1}
              </button>
            ))}
          </div>
        )}

        {/* Timer */}
        {contestStarted && (
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-charcoal/45 sm:inline">
              Time left
            </span>
            <span
              className={`rounded-lg px-3 py-1 font-mono text-xl font-bold tabular-nums ${
                countdown <= 60 && countdown > 0
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : ended
                    ? "bg-charcoal/10 text-charcoal/50"
                    : "bg-bronze/10 text-chocolate dark:text-cream"
              }`}
            >
              {formatClock(countdown)}
            </span>
          </div>
        )}
      </header>

      {!contestStarted ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <MechaPanel ticks bodyClassName="px-10 py-10 text-center">
            <div className="mx-auto mb-4 flex h-3 w-3 items-center justify-center">
              <span className="h-3 w-3 animate-ping rounded-full bg-amber-500/70" />
              <span className="absolute h-3 w-3 rounded-full bg-amber-500" />
            </div>
            <h2 className="font-display text-xl font-bold text-chocolate">
              Waiting for the contest to start
            </h2>
            <p className="mt-2 text-sm text-charcoal/60">
              Your teacher will start it shortly — this page updates automatically.
            </p>
          </MechaPanel>
        </div>
      ) : (
        <div className="relative flex-1">
          <div
            ref={splitContainerRef}
            className="absolute inset-0 flex flex-col gap-3 p-3 lg:flex-row lg:items-stretch"
            style={{ "--monstr-left": `${splitPct}%` } as React.CSSProperties}
          >
            {/* ── Left: problem ── */}
            <div className="min-h-0 w-full lg:w-[var(--monstr-left)] lg:shrink-0">
              <MechaPanel className="h-full" bodyClassName="flex h-full flex-col">
                <div className="flex h-11 shrink-0 items-center border-b border-hairline px-4">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-bronze">
                    Description
                  </span>
                </div>
                <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  <MonstrProblem
                    problem={currentProblem}
                    index={activeIndex < 0 ? 0 : activeIndex}
                    total={problems.length}
                  />
                </div>
              </MechaPanel>
            </div>

            {/* ── Divider ── */}
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
              className="group relative hidden w-1 shrink-0 cursor-col-resize touch-none select-none items-center justify-center self-stretch lg:flex"
            >
              <div className="h-10 w-[3px] rounded-full bg-hairline transition-colors group-hover:bg-bronze" />
            </div>

            {/* ── Right: editor + console ── */}
            <section className="flex min-h-0 w-full flex-col gap-3 lg:min-w-0 lg:flex-1">
              {/* Editor */}
              <div className="min-h-0 flex-1">
                <MechaPanel className="h-full" bodyClassName="flex h-full flex-col overflow-hidden">
                  <div className="flex h-11 shrink-0 items-center gap-3 border-b border-hairline px-3">
                    <select
                      value={language}
                      onChange={(e) => handleLanguageSwitch(e.target.value as LanguageId)}
                      disabled={loading}
                      className="rounded border border-hairline bg-white/70 px-2.5 py-1 font-mono text-xs font-medium text-chocolate dark:bg-panel/70"
                    >
                      {allowedLangOptions.map((lang) => (
                        <option key={lang.id} value={lang.id}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRun}
                        disabled={loading}
                        className="mecha-btn mecha-btn--ghost h-8 px-4 text-xs"
                      >
                        {loading ? "Running…" : "Run"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`mecha-btn mecha-btn--solid h-8 px-5 text-xs ${
                          !canSubmit ? "cursor-not-allowed opacity-50" : ""
                        }`}
                      >
                        {ended ? "Time's up" : loading ? "…" : "Submit"}
                      </button>
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-1">
                    <div className="absolute inset-0">
                      <CodeEditor value={code} onChange={setCode} language={language} />
                    </div>
                  </div>
                </MechaPanel>
              </div>

              {/* Console */}
              <div className="h-56 shrink-0">
                <MechaPanel className="h-full" bodyClassName="flex h-full flex-col overflow-hidden">
                  <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-hairline px-3">
                    {(["input", "result"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setConsoleTab(t)}
                        className={`rounded px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          consoleTab === t
                            ? "bg-bronze/15 text-bronze"
                            : "text-charcoal/50 hover:text-chocolate"
                        }`}
                      >
                        {t === "input" ? "Custom Input" : "Result"}
                      </button>
                    ))}
                    {ended && (
                      <span className="ml-auto mecha-chip bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        Contest ended — Run only
                      </span>
                    )}
                  </div>

                  <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto p-3">
                    {consoleTab === "input" ? (
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="Custom stdin for Run…"
                        className="h-full min-h-[6rem] w-full resize-none rounded border border-hairline bg-white/60 p-2.5 font-mono text-xs text-chocolate dark:bg-panel/60"
                        disabled={loading}
                      />
                    ) : result ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`mecha-chip ${
                              VERDICT_STYLE[result.verdict ?? "ERR"] ?? "bg-charcoal/10 text-charcoal/70"
                            }`}
                          >
                            {result.ok
                              ? VERDICT_LABEL[result.verdict ?? "RAN"] ?? result.verdict
                              : result.error || VERDICT_LABEL[result.verdict ?? "ERR"] || "Error"}
                          </span>
                        </div>
                        {result.message && result.message !== VERDICT_LABEL[result.verdict ?? ""] && (
                          <p className="text-xs text-charcoal/70">{result.message}</p>
                        )}
                        {(result.stdout || result.stderr || result.compileStderr) && (
                          <pre className="max-h-40 overflow-auto rounded border border-hairline bg-white/60 p-2.5 font-mono text-xs text-charcoal/85 dark:bg-panel/60">
                            {result.compileStderr || result.stderr || result.stdout}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <p className="grid h-full place-items-center text-center text-xs text-charcoal/45">
                        Run your code or submit to see the result here.
                      </p>
                    )}
                  </div>
                </MechaPanel>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
