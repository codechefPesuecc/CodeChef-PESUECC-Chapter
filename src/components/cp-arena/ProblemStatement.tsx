import type { ChallengeContent } from "@/lib/challenges";

/**
 * Server component — renders a challenge's public content (statement + structured
 * sections). The prose is Markdown pre-rendered to sanitized HTML at seed time (see
 * scripts/seed-challenges.ts and @/lib/markdown), so the request path serves stored
 * HTML with no Markdown library in the bundle. Element styling lives in the
 * `.arena-prose` scope in globals.css so it re-themes in dark mode. Hidden tests are
 * never passed here.
 */
export default function ProblemStatement({
  challenge,
}: {
  challenge: ChallengeContent;
}) {
  const { statement, inputFormat, outputFormat, constraints, sampleExplanations } =
    challenge.contentHtml;


  const diffStyles: Record<string, string> = {
    Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Hard: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  const diffClass = diffStyles[challenge.difficulty] || "bg-bronze/15 text-bronze";

  return (
    <div className="arena-prose">
      <div className="mb-6 border-b border-hairline pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl mb-3">
          {challenge.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`mecha-chip ${diffClass}`}>{challenge.difficulty}</span>
          {challenge.timeLimit && (
            <span className="text-xs font-medium text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-md">
              {challenge.timeLimit} limit
            </span>
          )}
          {challenge.memoryLimit && (
            <span className="text-xs font-medium text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-md">
              {challenge.memoryLimit}
            </span>
          )}
        </div>
      </div>
      
      <div dangerouslySetInnerHTML={{ __html: statement }} />

      {inputFormat && (
        <>
          <h2>Input Format</h2>
          <div dangerouslySetInnerHTML={{ __html: inputFormat }} />
        </>
      )}

      {outputFormat && (
        <>
          <h2>Output Format</h2>
          <div dangerouslySetInnerHTML={{ __html: outputFormat }} />
        </>
      )}

      {constraints && (
        <>
          <h2>Constraints</h2>
          <div dangerouslySetInnerHTML={{ __html: constraints }} />
        </>
      )}

      {challenge.samples.map((sample, i) => (
        <section key={i}>
          <h2>Sample{challenge.samples.length > 1 ? ` ${i + 1}` : ""}</h2>
          <div className="arena-io-label">Input</div>
          <pre>{sample.input.replace(/\n+$/, "")}</pre>
          <div className="arena-io-label">Output</div>
          <pre>{sample.output.replace(/\n+$/, "")}</pre>
          {sampleExplanations[i] && (
            <>
              <h3>Explanation</h3>
              <div dangerouslySetInnerHTML={{ __html: sampleExplanations[i] }} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
