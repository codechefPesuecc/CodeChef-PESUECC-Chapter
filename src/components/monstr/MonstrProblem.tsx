"use client";

/**
 * Client-side problem renderer for the Monstr contest workspace. Mirrors the CP
 * Arena's <ProblemStatement> markup and `.arena-prose` styling so a contest problem
 * looks identical to the daily arena. Prose is pre-rendered sanitized HTML stored in
 * `contentHtml` (JSON); falls back to the raw text fields for older rows.
 */
export interface MonstrProblemData {
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

function parseHtml(contentHtml: string | null) {
  if (!contentHtml) return null;
  try {
    return JSON.parse(contentHtml) as {
      statement?: string;
      inputFormat?: string;
      outputFormat?: string;
      constraints?: string;
      sampleExplanations?: string[];
    };
  } catch {
    return null;
  }
}

export default function MonstrProblem({
  problem,
  index,
  total,
}: {
  problem: MonstrProblemData;
  index: number;
  total: number;
}) {
  const html = parseHtml(problem.contentHtml);
  const sampleExpl = html?.sampleExplanations ?? [];

  const Section = ({ title, htmlBody, text }: { title: string; htmlBody?: string; text: string | null }) => {
    if (!htmlBody && !text) return null;
    return (
      <>
        <h2>{title}</h2>
        {htmlBody ? (
          <div dangerouslySetInnerHTML={{ __html: htmlBody }} />
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
      </>
    );
  };

  return (
    <div className="arena-prose">
      <div className="mb-6 border-b border-hairline pb-6">
        <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bronze">
          Problem {index + 1}
          {total > 1 ? ` of ${total}` : ""}
        </div>
        <h1 className="mb-3 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          {problem.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {problem.timeLimit && (
            <span className="rounded-md bg-charcoal/5 px-2 py-0.5 text-xs font-medium text-charcoal/50">
              {problem.timeLimit} limit
            </span>
          )}
          {problem.memoryLimit && (
            <span className="rounded-md bg-charcoal/5 px-2 py-0.5 text-xs font-medium text-charcoal/50">
              {problem.memoryLimit}
            </span>
          )}
        </div>
      </div>

      {html?.statement ? (
        <div dangerouslySetInnerHTML={{ __html: html.statement }} />
      ) : (
        <p className="whitespace-pre-wrap">{problem.statement}</p>
      )}

      <Section title="Input Format" htmlBody={html?.inputFormat} text={problem.inputFormat} />
      <Section title="Output Format" htmlBody={html?.outputFormat} text={problem.outputFormat} />
      <Section title="Constraints" htmlBody={html?.constraints} text={problem.constraints} />

      {problem.samples.map((sample, i) => (
        <section key={i}>
          <h2>Sample{problem.samples.length > 1 ? ` ${i + 1}` : ""}</h2>
          <div className="arena-io-label">Input</div>
          <pre>{sample.input.replace(/\n+$/, "")}</pre>
          <div className="arena-io-label">Output</div>
          <pre>{sample.output.replace(/\n+$/, "")}</pre>
          {sampleExpl[i] && (
            <>
              <h3>Explanation</h3>
              <div dangerouslySetInnerHTML={{ __html: sampleExpl[i] }} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
