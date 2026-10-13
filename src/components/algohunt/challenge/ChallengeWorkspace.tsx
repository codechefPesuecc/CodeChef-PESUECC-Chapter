"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import CodeEditor from "@/components/cp-arena/CodeEditor";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { ARENA_LANGUAGES, STARTER_CODE, type LanguageId } from "@/components/cp-arena/mockData";
import type { ChallengeView, SubmitResult } from "@/lib/algohunt/types";
import VerdictPanel from "./VerdictPanel";
import SubmissionList from "./SubmissionList";

// ── Split constants (drag-to-resize, same as ArenaWorkspace) ──────────────
const SPLIT_KEY = "ah:split-pct";
const SPLIT_MIN = 25;
const SPLIT_MAX = 75;
const clamp = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));

type Tab = "problem" | "code" | "result";

export interface ChallengeWorkspaceProps {
  view: ChallengeView;
  teamCode: string;
  statement: ReactNode;
  totalStages: number;
  solvedCount?: number;
}

export default function ChallengeWorkspace({
  view,
  teamCode,
  statement,
  totalStages,
}: ChallengeWorkspaceProps) {
  const { stageNumber, isFinal, languages, samples, solved: initialSolved } = view;

  // ── Language & code state ─────────────────────────────────────────────
  const defaultLangId = ((languages[0]?.id as LanguageId) ?? "cpp");
  const codeKey = (lang: string) => `ah:code-editor:${teamCode}:${stageNumber}:${lang}`;
  const langKey = `ah:lang:${teamCode}`;

  const loadCode = (lang: string): string => {
    return STARTER_CODE[lang as LanguageId] ?? "";
  };

  const [language, setLanguage] = useState<LanguageId>(defaultLangId);
  const [code, setCode] = useState<string>(() => loadCode(defaultLangId));
  const [tab, setTab] = useState<Tab>("problem");
  const [splitPct, setSplitPct] = useState(50);
  const [customInput, setCustomInput] = useState(samples[0]?.input ?? "");

  // Submission state
  const [running, setRunning] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SubmitResult | null>(null);
  const [runResult, setRunResult] = useState<{
    stdout: string; stderr: string; compileFailed: boolean;
    compileStderr: string; timedOut: boolean;
    executionTimeMs?: number; memoryBytes?: number;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [solved, setSolved] = useState(initialSolved);

  // Submission list refresh counter
  const [subRefresh, setSubRefresh] = useState(0);

  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const storedLang = localStorage.getItem(langKey);
        const targetLang = (storedLang && languages.some((l) => l.id === storedLang))
          ? (storedLang as LanguageId)
          : defaultLangId;
        if (targetLang !== defaultLangId) {
          setLanguage(targetLang);
        }
        const storedCode = localStorage.getItem(`ah:code-editor:${teamCode}:${stageNumber}:${targetLang}`);
        if (storedCode) {
          setCode(storedCode);
        } else if (STARTER_CODE[targetLang]) {
          setCode(STARTER_CODE[targetLang]);
        }
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [defaultLangId, langKey, languages, stageNumber, teamCode]);

  // ── Restore saved split on client ─────────────────────────────────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(SPLIT_KEY);
        const n = raw == null ? NaN : Number(raw);
        if (Number.isFinite(n)) setSplitPct(clamp(n));
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Debounced code autosave ───────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(`ah:code-editor:${teamCode}:${stageNumber}:${language}`, code);
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [code, language, stageNumber, teamCode]);

  // ── Persist split ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(SPLIT_KEY, String(Math.round(splitPct)));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [splitPct]);

  // ── Language change ───────────────────────────────────────────────────
  const changeLanguage = (lang: LanguageId) => {
    try {
      localStorage.setItem(codeKey(language), code);
      localStorage.setItem(langKey, lang);
    } catch {}
    let nextCode = STARTER_CODE[lang] ?? "";
    try {
      const stored = localStorage.getItem(codeKey(lang));
      if (stored) nextCode = stored;
    } catch {}
    setCode(nextCode);
    setLanguage(lang);
  };

  // ── Drag-to-resize (desktop) ──────────────────────────────────────────
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const apply = (clientX: number) => {
      const el = splitRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      setSplitPct(clamp(((clientX - rect.left) / rect.width) * 100));
    };
    const onMove = (ev: PointerEvent) => apply(ev.clientX);
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

  // ── Run ───────────────────────────────────────────────────────────────
  const run = async () => {
    if (running) return;
    setRunning(true);
    setBusyLabel("Running…");
    setRunResult(null);
    setRunError(null);
    setTab("result");
    try {
      const res = await fetch("/api/algohunt/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, code, stdin: customInput }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRunError(data.error ?? "Run failed.");
      } else {
        setRunResult(data);
      }
    } catch {
      setRunError("Connection problem. Could not reach the judge.");
    } finally {
      setRunning(false);
      setBusyLabel("");
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const submit = useCallback(async (retryId?: string) => {
    if (running || solved) return;
    const id = retryId ?? pendingId ?? crypto.randomUUID();
    setPendingId(id);
    setRunning(true);
    setBusyLabel("Submitting…");
    setVerdict(null);
    setRunResult(null);
    setTab("result");

    try {
      setBusyLabel("Judging against the hidden tests…");
      const res = await fetch("/api/algohunt/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, code, clientRequestId: id }),
      });
      const data = await res.json();
      setPendingId(null);

      if (!data.ok) {
        if (data.code === "ALREADY_SOLVED") {
          setSolved(true);
        }
        setVerdict({ ok: false, code: data.code, message: data.error } as unknown as SubmitResult);
        return;
      }

      setVerdict(data as SubmitResult);
      setSubRefresh((n) => n + 1);

      if (data.stage?.challengeSolved) {
        setSolved(true);
      }
      if (data.stage?.finished) {
        // Trigger a full page refresh so the layout/banner updates
        window.location.href = "/algohunt/challenge";
      }
    } catch {
      // Network failure — show retry with same pendingId
      setVerdict({
        submission: null,
        stage: { number: stageNumber, challengeSolved: false, needsCode: false, finished: false },
        message: "Connection problem. Your submission may not have reached us.",
      } as unknown as SubmitResult);
      // Keep pendingId so retry reuses it
    } finally {
      setRunning(false);
      setBusyLabel("");
    }
  }, [running, solved, pendingId, language, code, stageNumber]);

  // ── Verdict or connection error ────────────────────────────────────────
  const connectionError = verdict && (verdict as unknown as SubmitResult).submission === null;

  // ── Render ────────────────────────────────────────────────────────────
  const languageOptions = languages.length > 0
    ? languages
    : ARENA_LANGUAGES.map((l) => ({ id: l.id, label: l.label }));

  const runBtnDisabled = running;
  const submitBtnDisabled = running || solved;

  return (
    <div
      ref={splitRef}
      className="relative flex min-h-0 flex-1 flex-col gap-1 p-1.5 lg:flex-row lg:items-stretch"
      style={{ "--ah-left": `${splitPct}%` } as CSSProperties}
    >
      {/* ═══════ Panel A: Problem & Submissions (left on desktop, tabs on mobile) ═══════ */}
      <div className={`relative h-[45vh] w-full shrink-0 lg:h-full lg:w-[var(--ah-left)] min-h-0 ${tab === "code" ? "hidden lg:block" : "block"}`}>
        <div className="absolute inset-0">
          <MechaPanel className="h-full" bodyClassName="flex h-full flex-col overflow-hidden">
            {/* Mobile tabs */}
            <div className="flex h-10 shrink-0 items-center gap-4 border-b border-hairline px-4 lg:hidden">
              <button type="button" onClick={() => setTab("problem")} className={`lc-tab ${tab === "problem" ? "lc-tab--active" : ""}`}>
                Problem
              </button>
              <button type="button" onClick={() => setTab("code")} className={`lc-tab ${tab === "code" ? "lc-tab--active" : ""}`}>
                Code
              </button>
              <button type="button" onClick={() => setTab("result")} className={`lc-tab ${tab === "result" ? "lc-tab--active" : ""}`}>
                Result
              </button>
            </div>

            {/* Desktop tabs */}
            <div className="hidden h-10 shrink-0 items-center gap-4 border-b border-hairline px-4 lg:flex">
              <button type="button" onClick={() => setTab("problem")} className={`lc-tab ${tab === "problem" ? "lc-tab--active" : ""}`}>
                Description
              </button>
              <button type="button" onClick={() => setTab("result")} className={`lc-tab ${tab === "result" ? "lc-tab--active" : ""}`}>
                Result & Submissions
                {(running || verdict || runResult) && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-bronze" />
                )}
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              {/* Problem tab */}
              {tab === "problem" && (
                <div
                  data-lenis-prevent
                  className="h-full overflow-y-auto px-6 py-6 arena-prose"
                >
                  {statement}
                </div>
              )}

              {/* Result tab (submissions + run output + verdict) */}
              {tab === "result" && (
                <div data-lenis-prevent className="h-full overflow-y-auto px-4 py-4">
                  {/* Busy indicator */}
                  {running && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mb-3 flex items-center gap-2 rounded-lg border border-bronze/30 bg-bronze/10 px-4 py-2.5 text-sm font-medium text-bronze"
                    >
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-bronze border-t-transparent" />
                      {busyLabel || "Processing…"}
                    </div>
                  )}

                  {/* Verdict */}
                  {!running && verdict && (
                    <div role="status" aria-live="polite">
                      <VerdictPanel
                        result={verdict as unknown as SubmitResult}
                        stageNumber={stageNumber}
                        isFinal={isFinal}
                        onRetry={connectionError ? () => submit(pendingId ?? undefined) : undefined}
                      />
                    </div>
                  )}

                  {/* Run result */}
                  {!running && runResult && !verdict && (
                    <RunResultPanel result={runResult} />
                  )}
                  {!running && runError && !verdict && (
                    <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      {runError}
                    </div>
                  )}

                  {/* Submission list */}
                  <div className="mt-4">
                    <SubmissionList stageNumber={stageNumber} teamCode={teamCode} refresh={subRefresh} />
                  </div>
                </div>
              )}
            </div>
          </MechaPanel>
        </div>
      </div>

      {/* ═══════ Drag handle (desktop only) ═══════ */}
      <div
        role="separator"
        aria-label="Resize panels"
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSplitPct((p) => clamp(p - 2));
          if (e.key === "ArrowRight") setSplitPct((p) => clamp(p + 2));
        }}
        className="hidden w-1.5 cursor-col-resize rounded-full bg-hairline transition-colors hover:bg-bronze/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze lg:block"
      />

      {/* ═══════ Panel B: Editor + controls (right on desktop, Code tab on mobile) ═══════ */}
      <div className={`min-h-0 flex-1 flex-col gap-1 ${tab === "code" ? "flex" : "hidden"} lg:flex`}>
        {/* Editor panel */}
        <div className="relative min-h-[260px] flex-1 lg:min-h-0">
          <MechaPanel className="h-full" bodyClassName="flex h-full flex-col">
            {/* Editor toolbar */}
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline px-3">
              <select
                value={language}
                onChange={(e) => changeLanguage(e.target.value as LanguageId)}
                className="mecha-input h-7 min-w-0 max-w-[160px] text-xs font-mono"
                aria-label="Select programming language"
              >
                {languageOptions.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <span className="flex-1" />
              <span className="font-mono text-[11px] text-charcoal/40 dark:text-cream/40">
                Q{stageNumber}/{totalStages}
              </span>
            </div>
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 p-1" data-lenis-prevent>
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={language}
                  lockClipboard={false}
                  fullscreen
                />
              </div>
            </div>
          </MechaPanel>
        </div>

        {/* Custom input + Run/Submit */}
        <MechaPanel bodyClassName="flex flex-col shrink-0">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-hairline px-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/50 dark:text-cream/50">
              Custom Input
            </span>
            <span className="text-[11px] text-charcoal/40 dark:text-cream/40">
              Run uses this input · Submit always tests hidden cases
            </span>
          </div>
          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            rows={2}
            placeholder="Custom test input (leave empty for the first sample)"
            className="min-h-[50px] max-h-[100px] resize-y bg-transparent px-3 py-2 font-mono text-xs text-chocolate outline-none dark:text-cream"
            aria-label="Custom test input"
          />
          <div className="flex shrink-0 items-center justify-between border-t border-hairline px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={run}
                disabled={runBtnDisabled}
                className="mecha-btn h-8 min-w-[76px] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running && busyLabel.startsWith("Run") ? "Running…" : "Run"}
              </button>
              <button
                type="button"
                onClick={() => submit()}
                disabled={submitBtnDisabled}
                className="mecha-btn mecha-btn--primary h-8 min-w-[96px] px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                title="Submit (Ctrl+Enter)"
                aria-label={solved ? "Question already solved" : "Submit solution"}
              >
                {solved ? "Solved ✓" : running && !busyLabel.startsWith("Run") ? "Judging…" : "Submit"}
              </button>
            </div>
            {solved && (
              <span className="mecha-chip bg-green-500/15 text-xs font-semibold text-green-700 dark:text-green-400">
                Solved ✓
              </span>
            )}
          </div>
        </MechaPanel>
      </div>
    </div>
  );
}

// ── Run result panel ─────────────────────────────────────────────────────

function RunResultPanel({ result }: {
  result: {
    stdout: string; stderr: string; compileFailed: boolean;
    compileStderr: string; timedOut: boolean;
    executionTimeMs?: number; memoryBytes?: number;
  };
}) {
  if (result.compileFailed) {
    return (
      <div className="rounded-lg border border-gray-400/30 bg-gray-400/10 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-charcoal/60 dark:text-cream/60">Compilation Error</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-red-600 dark:text-red-400">
          {result.compileStderr || "Compilation failed."}
        </pre>
      </div>
    );
  }
  if (result.timedOut) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
        Time limit exceeded.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-hairline p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-charcoal/50 dark:text-cream/50">Output</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-chocolate dark:text-cream">
          {result.stdout || <span className="italic text-charcoal/40 dark:text-cream/40">(empty)</span>}
        </pre>
      </div>
      {result.stderr && (
        <div className="rounded-lg border border-gray-400/30 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-charcoal/50 dark:text-cream/50">Stderr</p>
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-xs text-charcoal/70 dark:text-cream/70">
            {result.stderr}
          </pre>
        </div>
      )}
      {(result.executionTimeMs !== undefined || result.memoryBytes !== undefined) && (
        <p className="text-xs text-charcoal/40 dark:text-cream/40">
          {result.executionTimeMs !== undefined && `${result.executionTimeMs}ms`}
          {result.memoryBytes !== undefined && ` · ${Math.round(result.memoryBytes / 1024)}KB`}
        </p>
      )}
    </div>
  );
}
