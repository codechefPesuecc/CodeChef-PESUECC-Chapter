"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/components/cp-arena/mockData";
import type { LanguageId } from "@/components/cp-arena/mockData";
import MarkdownPreview from "@/components/MarkdownPreview";

interface Sample {
  input: string;
  output: string;
}

interface TestCase {
  input: string;
  output: string;
}

interface ProblemForm {
  id: string;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  timeLimit: string;
  memoryLimit: string;
  samples: Sample[];
  tests: TestCase[];
  checker: "token" | "exact" | "float";
}

export default function CreateContestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageId[]>(["cpp", "python"]);
  const [problems, setProblems] = useState<ProblemForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // JSON import state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  const addProblem = () => {
    setProblems([
      ...problems,
      {
        id: crypto.randomUUID(),
        title: "",
        statement: "",
        inputFormat: "",
        outputFormat: "",
        constraints: "",
        timeLimit: "2s",
        memoryLimit: "256 MB",
        samples: [{ input: "", output: "" }],
        tests: [{ input: "", output: "" }],
        checker: "token",
      },
    ]);
  };

  const removeProblem = (id: string) => {
    setProblems(problems.filter((p) => p.id !== id));
  };

  function loadFromJson(text: string) {
    setImportError(null);
    setImportNote(null);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      setImportError(`Invalid JSON: ${(e as Error).message}`);
      return;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      setImportError("Expected a single problem object.");
      return;
    }

    const d = data as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const list = (v: unknown) => (Array.isArray(v) ? v : []);

    const missing: string[] = [];
    if (!str(d.title)) missing.push("title");
    if (!str(d.statement)) missing.push("statement");
    if (list(d.samples).length === 0) missing.push("samples (>= 1)");
    if (list(d.tests).length === 0) missing.push("tests (>= 1)");

    if (missing.length) {
      setImportError(
        `Missing or invalid: ${missing.join(", ")}. (Full validation still runs on create.)`,
      );
      return;
    }

    const newProblem: ProblemForm = {
      id: crypto.randomUUID(),
      title: str(d.title),
      statement: str(d.statement),
      inputFormat: str(d.inputFormat),
      outputFormat: str(d.outputFormat),
      constraints: str(d.constraints),
      timeLimit: str(d.timeLimit) || "2s",
      memoryLimit: str(d.memoryLimit) || "256 MB",
      samples: list(d.samples).map((s) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return { input: str(o.input), output: str(o.output) };
      }),
      tests: list(d.tests).map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        return { input: str(o.input), output: str(o.output) };
      }),
      checker: "token",
    };

    const checkerObj = (d.checker ?? {}) as Record<string, unknown>;
    const checkerType = str(checkerObj.type);
    if (checkerType === "exact" || checkerType === "float") {
      newProblem.checker = checkerType;
    }

    setProblems([...problems, newProblem]);
    setImportNote(`Loaded "${newProblem.title}" — review below, then create contest.`);
    setImportOpen(false);
    setImportText("");
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((t) => loadFromJson(t))
      .catch(() => setImportError("Could not read the file."));
    e.target.value = "";
  }

  const updateProblem = (id: string, updates: Partial<ProblemForm>) => {
    setProblems(
      problems.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  };

  const addSample = (problemId: string) => {
    updateProblem(problemId, {
      samples: [
        ...problems.find((p) => p.id === problemId)!.samples,
        { input: "", output: "" },
      ],
    });
  };

  const removeSample = (problemId: string, index: number) => {
    updateProblem(problemId, {
      samples: problems
        .find((p) => p.id === problemId)!
        .samples.filter((_, i) => i !== index),
    });
  };

  const addTest = (problemId: string) => {
    updateProblem(problemId, {
      tests: [
        ...problems.find((p) => p.id === problemId)!.tests,
        { input: "", output: "" },
      ],
    });
  };

  const removeTest = (problemId: string, index: number) => {
    updateProblem(problemId, {
      tests: problems
        .find((p) => p.id === problemId)!
        .tests.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Contest title is required.");
      return;
    }
    if (selectedLanguages.length === 0) {
      setError("Select at least one language.");
      return;
    }
    if (problems.length === 0) {
      setError("Add at least one problem.");
      return;
    }

    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      if (!p.title.trim()) {
        setError(`Problem ${i + 1}: title is required.`);
        return;
      }
      if (!p.statement.trim()) {
        setError(`Problem ${i + 1}: statement is required.`);
        return;
      }
      if (p.samples.length === 0 || p.samples.some((s) => !s.input || !s.output)) {
        setError(`Problem ${i + 1}: at least one sample with input/output is required.`);
        return;
      }
      if (p.tests.length === 0 || p.tests.some((t) => !t.input || !t.output)) {
        setError(`Problem ${i + 1}: at least one hidden test with input/output is required.`);
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/monstr/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          durationMinutes,
          allowedLanguages: selectedLanguages,
          problems: problems.map((p) => ({
            title: p.title,
            statement: p.statement,
            inputFormat: p.inputFormat || undefined,
            outputFormat: p.outputFormat || undefined,
            constraints: p.constraints || undefined,
            timeLimit: p.timeLimit || undefined,
            memoryLimit: p.memoryLimit || undefined,
            samples: p.samples,
            tests: p.tests,
            checker:
              p.checker === "token"
                ? { type: "token" }
                : p.checker === "exact"
                  ? { type: "exact" }
                  : { type: "float", epsilon: 1e-6 },
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create contest.");
        return;
      }

      const data = await res.json();
      router.push(`/monstr/teacher/contests/${data.contestId}`);
    } catch {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Contest info */}
      <div className="mecha-wrapper space-y-4">
        <h2 className="text-lg font-semibold">Contest Details</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Competitive Programming Challenge 2024"
            className="mecha-input w-full"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
          <input
            type="number"
            min="5"
            max="480"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Math.max(5, Math.min(480, parseInt(e.target.value) || 5)))}
            className="mecha-input w-full"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Allowed Languages</label>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => (
              <label key={lang.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(lang.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLanguages([...selectedLanguages, lang.id]);
                    } else {
                      setSelectedLanguages(selectedLanguages.filter((l) => l !== lang.id));
                    }
                  }}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <span className="text-sm">{lang.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Import from JSON */}
      <section className="rounded-xl border border-hairline bg-cream/40 p-4 dark:bg-white/[0.02]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-bold text-chocolate">
              Import Problem from JSON
            </h2>
            <p className="mt-0.5 text-[11px] text-charcoal/50">
              Paste a problem in JSON schema (or upload a .json file) to quickly add it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-bronze hover:underline"
          >
            {importOpen ? "Hide" : "Import"}
          </button>
        </div>

        {importNote && !importOpen && (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            {importNote}
          </p>
        )}

        {importOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="mecha-btn mecha-btn--ghost mecha-btn--sm cursor-pointer">
                Upload .json
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={onImportFile}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-charcoal/45">or paste below</span>
            </div>
            <textarea
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-chocolate shadow-sm outline-none transition focus:border-bronze/50 focus:ring-2 focus:ring-bronze/30 dark:bg-panel dark:text-cream font-mono"
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                '{ "title": "…", "statement": "…", "samples": [{ "input": "…", "output": "…" }], "tests": [{ "input": "…", "output": "…" }], "checker": { "type": "token" } }'
              }
            />
            {importError && (
              <p className="text-xs text-red-700 dark:text-red-400">{importError}</p>
            )}
            <button
              type="button"
              onClick={() => loadFromJson(importText)}
              disabled={!importText.trim()}
              className="mecha-btn mecha-btn--solid mecha-btn--sm disabled:opacity-50"
            >
              Load into form
            </button>
          </div>
        )}
      </section>

      {/* Problems */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Problems</h2>
          <button
            type="button"
            onClick={addProblem}
            disabled={loading}
            className="mecha-btn text-sm"
          >
            + Add Problem
          </button>
        </div>

        {problems.map((problem, idx) => (
          <ProblemEditor
            key={problem.id}
            index={idx}
            problem={problem}
            onUpdate={(updates) => updateProblem(problem.id, updates)}
            onRemove={() => removeProblem(problem.id)}
            onAddSample={() => addSample(problem.id)}
            onRemoveSample={(i) => removeSample(problem.id, i)}
            onAddTest={() => addTest(problem.id)}
            onRemoveTest={(i) => removeTest(problem.id, i)}
            disabled={loading}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mecha-btn mecha-btn--solid w-full"
      >
        {loading ? "Creating..." : "Create Contest"}
      </button>
    </form>
  );
}

interface ProblemEditorProps {
  index: number;
  problem: ProblemForm;
  onUpdate: (updates: Partial<ProblemForm>) => void;
  onRemove: () => void;
  onAddSample: () => void;
  onRemoveSample: (index: number) => void;
  onAddTest: () => void;
  onRemoveTest: (index: number) => void;
  disabled: boolean;
}

function ProblemEditor({
  index,
  problem,
  onUpdate,
  onRemove,
  onAddSample,
  onRemoveSample,
  onAddTest,
  onRemoveTest,
  disabled,
}: ProblemEditorProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mecha-wrapper space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="font-semibold text-chocolate hover:text-bronze transition cursor-pointer flex-1 text-left"
        >
          Problem {index + 1}: {problem.title || "(untitled)"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="mecha-btn text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-sm"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={problem.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Problem title"
              className="mecha-input w-full"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Statement</label>
            <textarea
              value={problem.statement}
              onChange={(e) => onUpdate({ statement: e.target.value })}
              placeholder="Problem description (Markdown)"
              rows={4}
              className="mecha-input w-full font-mono text-sm"
              disabled={disabled}
            />
            {problem.statement && <MarkdownPreview markdown={problem.statement} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Input Format</label>
              <textarea
                value={problem.inputFormat}
                onChange={(e) => onUpdate({ inputFormat: e.target.value })}
                placeholder="Input format (Markdown)"
                rows={3}
                className="mecha-input w-full font-mono text-sm"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Format</label>
              <textarea
                value={problem.outputFormat}
                onChange={(e) => onUpdate({ outputFormat: e.target.value })}
                placeholder="Output format (Markdown)"
                rows={3}
                className="mecha-input w-full font-mono text-sm"
                disabled={disabled}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Constraints</label>
            <textarea
              value={problem.constraints}
              onChange={(e) => onUpdate({ constraints: e.target.value })}
              placeholder="Constraints (Markdown)"
              rows={2}
              className="mecha-input w-full font-mono text-sm"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Time Limit</label>
              <input
                type="text"
                value={problem.timeLimit}
                onChange={(e) => onUpdate({ timeLimit: e.target.value })}
                placeholder="e.g., 2s"
                className="mecha-input w-full"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Memory Limit</label>
              <input
                type="text"
                value={problem.memoryLimit}
                onChange={(e) => onUpdate({ memoryLimit: e.target.value })}
                placeholder="e.g., 256 MB"
                className="mecha-input w-full"
                disabled={disabled}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Checker Type</label>
            <select
              value={problem.checker}
              onChange={(e) => onUpdate({ checker: e.target.value as ProblemForm["checker"] })}
              className="mecha-input w-full"
              disabled={disabled}
            >
              <option value="token">Token (whitespace-insensitive)</option>
              <option value="exact">Exact (line-by-line)</option>
              <option value="float">Float (epsilon comparison)</option>
            </select>
          </div>

          {/* Samples */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Samples</label>
              <button
                type="button"
                onClick={onAddSample}
                disabled={disabled}
                className="mecha-btn text-sm"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {problem.samples.map((sample, i) => (
                <div key={i} className="space-y-1 p-2 bg-cream/20 dark:bg-white/5 rounded">
                  <textarea
                    value={sample.input}
                    onChange={(e) => {
                      const newSamples = [...problem.samples];
                      newSamples[i].input = e.target.value;
                      onUpdate({ samples: newSamples });
                    }}
                    placeholder="Input"
                    rows={2}
                    className="mecha-input w-full font-mono text-xs"
                    disabled={disabled}
                  />
                  <textarea
                    value={sample.output}
                    onChange={(e) => {
                      const newSamples = [...problem.samples];
                      newSamples[i].output = e.target.value;
                      onUpdate({ samples: newSamples });
                    }}
                    placeholder="Output"
                    rows={2}
                    className="mecha-input w-full font-mono text-xs"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveSample(i)}
                    disabled={disabled}
                    className="mecha-btn text-red-600 text-xs"
                  >
                    Remove sample
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tests */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Hidden Tests</label>
              <button
                type="button"
                onClick={onAddTest}
                disabled={disabled}
                className="mecha-btn text-sm"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {problem.tests.map((test, i) => (
                <div key={i} className="space-y-1 p-2 bg-cream/20 dark:bg-white/5 rounded">
                  <textarea
                    value={test.input}
                    onChange={(e) => {
                      const newTests = [...problem.tests];
                      newTests[i].input = e.target.value;
                      onUpdate({ tests: newTests });
                    }}
                    placeholder="Input"
                    rows={2}
                    className="mecha-input w-full font-mono text-xs"
                    disabled={disabled}
                  />
                  <textarea
                    value={test.output}
                    onChange={(e) => {
                      const newTests = [...problem.tests];
                      newTests[i].output = e.target.value;
                      onUpdate({ tests: newTests });
                    }}
                    placeholder="Output"
                    rows={2}
                    className="mecha-input w-full font-mono text-xs"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveTest(i)}
                    disabled={disabled}
                    className="mecha-btn text-red-600 text-xs"
                  >
                    Remove test
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
