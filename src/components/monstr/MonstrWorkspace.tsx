"use client";

import { useEffect, useState } from "react";
import CodeEditor from "@/components/cp-arena/CodeEditor";
import { LANGUAGES, STARTER_CODE, formatClock } from "@/components/cp-arena/mockData";
import type { LanguageId } from "@/components/cp-arena/mockData";

interface Problem {
  id: string;
  title: string;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  samples: Array<{ input: string; output: string }>;
  contentHtml: string | null;
  timeLimit: string | null;
  memoryLimit: string | null;
}

interface Props {
  contestId: string;
  startedAt: number | null;
  endsAt: number | null;
  serverNow: number;
  problems: Array<{ id: string; title: string; orderIndex: number }>;
  allowedLanguages: LanguageId[];
  initialProblem: Problem;
}

export default function MonstrWorkspace({
  contestId,
  startedAt,
  endsAt,
  serverNow,
  problems,
  allowedLanguages,
  initialProblem,
}: Props) {
  const [activeProblemId, setActiveProblemId] = useState(initialProblem.id);
  const [language, setLanguage] = useState<LanguageId>(
    allowedLanguages[0] || "cpp"
  );
  const [code, setCode] = useState(STARTER_CODE[language] || "");
  const [customInput, setCustomInput] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string; stdout?: string; verdict?: string; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [contestStarted, setContestStarted] = useState(!!startedAt);
  // Store endsAt in state so it updates from polling (not just initial prop)
  const [serverEndsAt, setServerEndsAt] = useState(endsAt);
  const [problemCache, setProblemCache] = useState<Map<string, Problem>>(
    new Map([[initialProblem.id, initialProblem]])
  );

  // Timer countdown - uses serverEndsAt which updates from poll
  useEffect(() => {
    if (!contestStarted || !serverEndsAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((serverEndsAt - now) / 1000));
      setCountdown(remaining);

      if (remaining === 0) {
        setLoading(false);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [contestStarted, serverEndsAt]);

  // Status polling (check if contest started and update endsAt)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/monstr/contests/${contestId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.startedAt && !contestStarted) {
            setContestStarted(true);
          }
          // Update serverEndsAt from poll response
          if (data.endsAt) {
            setServerEndsAt(data.endsAt);
          }
        }
      } catch (e) {
        console.warn("[MonstrWorkspace] Status poll failed:", e);
      }
    };

    const timer = setInterval(poll, 10000);
    return () => clearInterval(timer);
  }, [contestId, contestStarted]);

  // Load problem details
  const loadProblem = async (problemId: string) => {
    if (problemCache.has(problemId)) return;

    try {
      const res = await fetch(
        `/api/monstr/contests/${contestId}/problems/${problemId}`
      );
      if (res.ok) {
        const problem = await res.json();
        setProblemCache((prev) => new Map(prev).set(problemId, problem));
      }
    } catch (e) {
      console.warn("[MonstrWorkspace] Failed to load problem:", e);
    }
  };

  // Handle problem switch - load code before switching to avoid clobbering
  const handleProblemSwitch = (problemId: string) => {
    // Ensure the new problem is loaded
    loadProblem(problemId);
    // Load the saved code for this problem and current language
    const stored = localStorage.getItem(
      `monstr:code:${contestId}:${problemId}:${language}`
    );
    setCode(stored || STARTER_CODE[language] || "");
    // Switch problem
    setActiveProblemId(problemId);
  };

  // Handle language switch
  const handleLanguageSwitch = (newLang: LanguageId) => {
    setLanguage(newLang);
    const stored = localStorage.getItem(
      `monstr:code:${contestId}:${activeProblemId}:${newLang}`
    );
    setCode(stored || STARTER_CODE[newLang] || "");
  };

  // Save code to localStorage
  useEffect(() => {
    localStorage.setItem(
      `monstr:code:${contestId}:${activeProblemId}:${language}`,
      code
    );
  }, [code, contestId, activeProblemId, language]);

  // Handle run
  const handleRun = async () => {
    if (!contestStarted) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: activeProblemId,
          language,
          code,
          stdin: customInput,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: "Run failed." });
    } finally {
      setLoading(false);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!contestStarted || countdown === 0) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/monstr/contests/${contestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: activeProblemId,
          language,
          code,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setResult({
          ok: true,
          verdict: data.verdict,
          message: `Verdict: ${data.verdict}`,
        });
      } else {
        setResult(data);
      }
    } catch (err) {
      setResult({ ok: false, error: "Submit failed." });
    } finally {
      setLoading(false);
    }
  };

  const currentProblem =
    problemCache.get(activeProblemId) || initialProblem;
  const canSubmit = contestStarted && countdown > 0;
  const allowedLangOptions = LANGUAGES.filter((l) =>
    allowedLanguages.includes(l.id)
  );

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="border-b border-hairline bg-white/60 dark:bg-panel/60 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-chocolate">
            Contest
          </h1>
        </div>
        {contestStarted && (
          <div
            className={`font-mono text-2xl font-bold ${
              countdown <= 60 ? "text-red-600" : "text-chocolate"
            }`}
          >
            {formatClock(countdown)}
          </div>
        )}
      </header>

      {!contestStarted ? (
        /* Waiting for contest start */
        <div className="flex-1 flex items-center justify-center">
          <div className="mecha-wrapper text-center">
            <p className="text-lg font-semibold mb-2">Waiting for contest to start...</p>
            <p className="text-sm text-charcoal/60">
              The teacher will start the contest soon.
            </p>
          </div>
        </div>
      ) : (
        /* Workspace */
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Problems */}
          <div className="w-1/2 border-r border-hairline overflow-y-auto">
            {/* Problem tabs */}
            <div className="border-b border-hairline sticky top-0 bg-white dark:bg-black">
              <div className="flex overflow-x-auto px-3 py-2">
                {problems.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => handleProblemSwitch(p.id)}
                    className={`mecha-tab ${
                      activeProblemId === p.id
                        ? "border-b-2 border-chocolate text-chocolate"
                        : "border-b-2 border-transparent text-charcoal/60"
                    }`}
                  >
                    P{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Problem content */}
            <div className="p-4 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {currentProblem.title}
              </h2>

              {currentProblem.contentHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      try {
                        return JSON.parse(currentProblem.contentHtml).statement || currentProblem.statement;
                      } catch {
                        return currentProblem.statement;
                      }
                    })(),
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap">{currentProblem.statement}</p>
              )}

              {/* Render Input/Output/Constraints sections */}
              {currentProblem.inputFormat && (
                <div className="space-y-2 border-t border-hairline pt-3">
                  <h3 className="font-semibold text-sm">Input Format</h3>
                  <p className="text-sm whitespace-pre-wrap">{currentProblem.inputFormat}</p>
                </div>
              )}

              {currentProblem.outputFormat && (
                <div className="space-y-2 border-t border-hairline pt-3">
                  <h3 className="font-semibold text-sm">Output Format</h3>
                  <p className="text-sm whitespace-pre-wrap">{currentProblem.outputFormat}</p>
                </div>
              )}

              {currentProblem.constraints && (
                <div className="space-y-2 border-t border-hairline pt-3">
                  <h3 className="font-semibold text-sm">Constraints</h3>
                  <p className="text-sm whitespace-pre-wrap">{currentProblem.constraints}</p>
                </div>
              )}

              {currentProblem.samples.length > 0 && (
                <div className="space-y-2 border-t border-hairline pt-3">
                  <h3 className="font-semibold">Samples</h3>
                  {currentProblem.samples.map((sample, idx) => (
                    <div key={idx} className="p-2 bg-cream/20 dark:bg-white/5 rounded">
                      <p className="text-xs font-mono text-charcoal/60 mb-1">
                        Input:
                      </p>
                      <p className="font-mono text-sm mb-2 bg-white/50 dark:bg-black/50 p-2 rounded">
                        {sample.input}
                      </p>
                      <p className="text-xs font-mono text-charcoal/60 mb-1">
                        Output:
                      </p>
                      <p className="font-mono text-sm bg-white/50 dark:bg-black/50 p-2 rounded">
                        {sample.output}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Editor & Console */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {/* Language selector */}
            <div className="border-b border-hairline bg-white/60 dark:bg-panel/60 px-4 py-3">
              <select
                value={language}
                onChange={(e) => handleLanguageSwitch(e.target.value as LanguageId)}
                disabled={loading}
                className="mecha-input text-sm"
              >
                {allowedLangOptions.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden border-b border-hairline">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
              />
            </div>

            {/* Console / Input */}
            <div className="h-1/3 overflow-y-auto border-t border-hairline">
              <div className="mecha-tabs flex border-b border-hairline sticky top-0 bg-white dark:bg-black">
                <div className="mecha-tab border-b-2 border-chocolate text-chocolate">
                  Input/Output
                </div>
              </div>

              <div className="p-3 space-y-2">
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Custom input"
                  rows={3}
                  className="mecha-input w-full font-mono text-xs"
                  disabled={loading}
                />

                {result && (
                  <div className={`p-2 rounded text-sm font-mono ${
                    result.ok && result.verdict === "AC"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      : !result.ok
                        ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                        : "bg-gray-100 dark:bg-gray-900/30 text-charcoal/80"
                  }`}>
                    <p className="font-semibold">
                      {result.ok
                        ? result.verdict || "OK"
                        : result.error || "Error"}
                    </p>
                    {result.message && <p className="text-xs mt-1">{result.message}</p>}
                    {result.stdout && (
                      <p className="mt-2 bg-black/10 dark:bg-white/10 p-1 rounded">
                        {result.stdout}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Contest Ended Banner */}
            {countdown === 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-700 p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 font-semibold">
                  Contest has ended. You can run code but cannot submit.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="border-t border-hairline bg-white/60 dark:bg-panel/60 p-3 flex gap-2">
              <button
                onClick={handleRun}
                disabled={loading}
                className="mecha-btn flex-1"
              >
                {loading ? "..." : "Run"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !canSubmit}
                className={`mecha-btn mecha-btn--solid flex-1 ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loading ? "..." : canSubmit ? "Submit" : "Submit (Time's up)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
