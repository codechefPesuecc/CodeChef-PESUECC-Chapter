"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Challenge } from "@/lib/challenges";

/**
 * Create / edit form for a CP Arena problem. Submits the full authoring payload
 * (incl. hidden tests + checker) to the admin API, which validates it with the same
 * schema the seed uses and renders content_html server-side. On edit the slug is
 * immutable (a rename would orphan submissions) so the field is locked.
 */

interface SampleField {
  input: string;
  output: string;
  explanation: string;
}
interface TestField {
  input: string;
  output: string;
}

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Unrated"] as const;
const CHECKERS = ["token", "exact", "float"] as const;

const inputCls =
  "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-chocolate shadow-sm outline-none transition focus:border-bronze/50 focus:ring-2 focus:ring-bronze/30 dark:bg-panel dark:text-cream";
const labelCls =
  "mb-1 block font-mono text-[11px] uppercase tracking-wider text-charcoal/50";
const mono = "font-mono";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ProblemForm({ initial }: { initial?: Challenge }) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [date, setDate] = useState(initial?.date ?? "");
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? "Unrated");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [timeLimit, setTimeLimit] = useState(initial?.timeLimit ?? "");
  const [memoryLimit, setMemoryLimit] = useState(initial?.memoryLimit ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [statement, setStatement] = useState(initial?.statement ?? "");
  const [inputFormat, setInputFormat] = useState(initial?.inputFormat ?? "");
  const [outputFormat, setOutputFormat] = useState(initial?.outputFormat ?? "");
  const [constraints, setConstraints] = useState(initial?.constraints ?? "");
  const [samples, setSamples] = useState<SampleField[]>(
    initial?.samples.map((s) => ({
      input: s.input,
      output: s.output,
      explanation: s.explanation ?? "",
    })) ?? [{ input: "", output: "", explanation: "" }],
  );
  const [tests, setTests] = useState<TestField[]>(
    initial?.tests.map((t) => ({ input: t.input, output: t.output })) ?? [
      { input: "", output: "" },
    ],
  );
  const [checkerType, setCheckerType] = useState<string>(initial?.checker.type ?? "token");
  const [epsilon, setEpsilon] = useState(
    initial?.checker.epsilon != null ? String(initial.checker.epsilon) : "",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);

  // --- Import from JSON (the same authoring schema as challenges/*.json) ---
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

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
        `Missing or invalid: ${missing.join(", ")}. (Full validation still runs on save.)`,
      );
      return;
    }

    setTitle(str(d.title));
    setSlug(str(d.slug) || slugify(str(d.title)));
    setSlugTouched(true);
    setDate(str(d.date));
    const diff = str(d.difficulty);
    setDifficulty((DIFFICULTIES as readonly string[]).includes(diff) ? diff : "Unrated");
    setTags(
      list(d.tags)
        .map((t) => str(t))
        .filter(Boolean)
        .join(", "),
    );
    setTimeLimit(str(d.timeLimit));
    setMemoryLimit(str(d.memoryLimit));
    setAuthor(str(d.author));
    setStatement(str(d.statement));
    setInputFormat(str(d.inputFormat));
    setOutputFormat(str(d.outputFormat));
    setConstraints(str(d.constraints));
    setSamples(
      list(d.samples).map((s) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return { input: str(o.input), output: str(o.output), explanation: str(o.explanation) };
      }),
    );
    setTests(
      list(d.tests).map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        return { input: str(o.input), output: str(o.output) };
      }),
    );
    const checker = (d.checker ?? {}) as Record<string, unknown>;
    const ctype = str(checker.type);
    setCheckerType((CHECKERS as readonly string[]).includes(ctype) ? ctype : "token");
    setEpsilon(typeof checker.epsilon === "number" ? String(checker.epsilon) : "");

    setImportNote(`Loaded "${str(d.title)}" — review the fields below, then Create problem.`);
    setImportOpen(false);
    setImportText("");
    setError(null);
    setIssues([]);
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((t) => loadFromJson(t))
      .catch(() => setImportError("Could not read the file."));
    e.target.value = ""; // allow re-selecting the same file
  }

  const onTitle = (v: string) => {
    setTitle(v);
    if (!isEdit && !slugTouched) setSlug(slugify(v));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setIssues([]);

    const payload = {
      slug: slug.trim(),
      title: title.trim(),
      difficulty,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      date: date.trim() || undefined,
      timeLimit: timeLimit.trim() || undefined,
      memoryLimit: memoryLimit.trim() || undefined,
      author: author.trim() || undefined,
      statement,
      inputFormat: inputFormat.trim() ? inputFormat : undefined,
      outputFormat: outputFormat.trim() ? outputFormat : undefined,
      constraints: constraints.trim() ? constraints : undefined,
      samples: samples.map((s) => ({
        input: s.input,
        output: s.output,
        ...(s.explanation.trim() ? { explanation: s.explanation } : {}),
      })),
      tests: tests.map((t) => ({ input: t.input, output: t.output })),
      checker: {
        type: checkerType,
        ...(checkerType === "float" && epsilon.trim()
          ? { epsilon: Number(epsilon) }
          : {}),
      },
    };

    try {
      const res = await fetch(
        isEdit ? `/api/admin/problems/${initial!.slug}` : "/api/admin/problems",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong.");
        setIssues(data.issues ?? []);
        setSubmitting(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-semibold">{error}</p>
          {issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {issues.map((i, n) => (
                <li key={n}>
                  <span className={mono}>{i.path || "(root)"}</span>: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Import from JSON — create mode only */}
      {!isEdit && (
        <section className="rounded-xl border border-hairline bg-cream/40 p-4 dark:bg-white/[0.02]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-sm font-bold text-chocolate">
                Import from JSON
              </h2>
              <p className="mt-0.5 text-[11px] text-charcoal/50">
                Paste a problem in the challenge JSON schema (or upload a .json file)
                to fill in the form below.
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
                className={`${inputCls} ${mono}`}
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={
                  '{ "title": "…", "date": "2026-07-20", "difficulty": "Easy", "statement": "…", "samples": [{ "input": "…", "output": "…" }], "tests": [{ "input": "…", "output": "…" }], "checker": { "type": "token" } }'
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
      )}

      {/* Metadata */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Title *</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Chef's Candy Distribution"
          />
        </div>
        <div>
          <label className={labelCls}>Slug *</label>
          <input
            className={`${inputCls} ${mono} ${isEdit ? "opacity-60" : ""}`}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            disabled={isEdit}
            placeholder="2026-07-20-chefs-candy-distribution"
          />
          {isEdit && (
            <p className="mt-1 text-[11px] text-charcoal/45">
              Slug is fixed once created (renaming would orphan submissions).
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Problem-of-the-Day date (IST)</label>
          <input
            type="date"
            className={`${inputCls} ${mono}`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-charcoal/45">
            Leave blank to save to the <strong>pool</strong> and schedule it later.
            A future date queues it (hidden until then); today makes it live now.
          </p>
        </div>
        <div>
          <label className={labelCls}>Difficulty</label>
          <select
            className={inputCls}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tags (comma-separated)</label>
          <input
            className={inputCls}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="greedy, sorting"
          />
        </div>
        <div>
          <label className={labelCls}>Time limit</label>
          <input
            className={`${inputCls} ${mono}`}
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="1s"
          />
        </div>
        <div>
          <label className={labelCls}>Memory limit</label>
          <input
            className={`${inputCls} ${mono}`}
            value={memoryLimit}
            onChange={(e) => setMemoryLimit(e.target.value)}
            placeholder="256 MB"
          />
        </div>
        <div>
          <label className={labelCls}>Author</label>
          <input
            className={inputCls}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="optional"
          />
        </div>
      </section>

      {/* Prose (Markdown, previewable) */}
      <section className="space-y-5">
        <MarkdownField label="Statement *" value={statement} onChange={setStatement} rows={10} />
        <MarkdownField label="Input format" value={inputFormat} onChange={setInputFormat} />
        <MarkdownField label="Output format" value={outputFormat} onChange={setOutputFormat} />
        <MarkdownField label="Constraints" value={constraints} onChange={setConstraints} />
      </section>

      {/* Samples */}
      <section>
        <SectionHeader
          title="Samples (public)"
          onAdd={() =>
            setSamples((s) => [...s, { input: "", output: "", explanation: "" }])
          }
        />
        <div className="mt-3 space-y-4">
          {samples.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-hairline bg-cream/40 p-4 dark:bg-white/[0.02]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-charcoal/50">
                  Sample {i + 1}
                </span>
                {samples.length > 1 && (
                  <RemoveButton
                    onClick={() =>
                      setSamples((arr) => arr.filter((_, n) => n !== i))
                    }
                  />
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Input">
                  <textarea
                    className={`${inputCls} ${mono}`}
                    rows={3}
                    value={s.input}
                    onChange={(e) =>
                      setSamples((arr) =>
                        arr.map((x, n) =>
                          n === i ? { ...x, input: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Output">
                  <textarea
                    className={`${inputCls} ${mono}`}
                    rows={3}
                    value={s.output}
                    onChange={(e) =>
                      setSamples((arr) =>
                        arr.map((x, n) =>
                          n === i ? { ...x, output: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Explanation (Markdown, optional)">
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={s.explanation}
                    onChange={(e) =>
                      setSamples((arr) =>
                        arr.map((x, n) =>
                          n === i ? { ...x, explanation: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden tests */}
      <section>
        <SectionHeader
          title="Hidden tests (secret — judge only)"
          onAdd={() => setTests((t) => [...t, { input: "", output: "" }])}
        />
        <div className="mt-3 space-y-4">
          {tests.map((t, i) => (
            <div
              key={i}
              className="rounded-xl border border-hairline bg-cream/40 p-4 dark:bg-white/[0.02]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-charcoal/50">
                  Test {i + 1}
                </span>
                {tests.length > 1 && (
                  <RemoveButton
                    onClick={() => setTests((arr) => arr.filter((_, n) => n !== i))}
                  />
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Input">
                  <textarea
                    className={`${inputCls} ${mono}`}
                    rows={3}
                    value={t.input}
                    onChange={(e) =>
                      setTests((arr) =>
                        arr.map((x, n) =>
                          n === i ? { ...x, input: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Expected output">
                  <textarea
                    className={`${inputCls} ${mono}`}
                    rows={3}
                    value={t.output}
                    onChange={(e) =>
                      setTests((arr) =>
                        arr.map((x, n) =>
                          n === i ? { ...x, output: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Checker */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Checker</label>
          <select
            className={inputCls}
            value={checkerType}
            onChange={(e) => setCheckerType(e.target.value)}
          >
            {CHECKERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {checkerType === "float" && (
          <div>
            <label className={labelCls}>Epsilon</label>
            <input
              className={`${inputCls} ${mono}`}
              value={epsilon}
              onChange={(e) => setEpsilon(e.target.value)}
              placeholder="1e-6"
            />
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 border-t border-hairline pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="mecha-btn mecha-btn--solid disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create problem"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mecha-btn mecha-btn--ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function MarkdownField({
  label,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (preview) {
      setPreview(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: value }),
      });
      const d = await res.json();
      setHtml(d.html ?? "");
    } catch {
      setHtml("<p><em>Preview failed.</em></p>");
    }
    setLoading(false);
    setPreview(true);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        <button
          type="button"
          onClick={toggle}
          className="font-mono text-[11px] uppercase tracking-wider text-bronze hover:underline"
        >
          {loading ? "…" : preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div
          className="arena-prose min-h-24 rounded-lg border border-hairline bg-white px-4 py-3 dark:bg-panel"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <textarea
          className={inputCls}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline pb-2">
      <h2 className="font-display text-sm font-bold text-chocolate">{title}</h2>
      <button
        type="button"
        onClick={onAdd}
        className="font-mono text-[11px] uppercase tracking-wider text-bronze hover:underline"
      >
        + Add
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-charcoal/40">
        {label}
      </span>
      {children}
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[11px] uppercase tracking-wider text-red-600/80 hover:underline dark:text-red-400/80"
    >
      Remove
    </button>
  );
}
