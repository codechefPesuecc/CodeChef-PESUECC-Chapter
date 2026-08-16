import type { ChallengeContent } from "@/lib/challenges";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Server component — renders a challenge's public content (statement + structured
 * sections) to styled HTML. Prose fields are Markdown, rendered to sanitized HTML
 * on the server (no client-side Markdown library); element styling lives in the
 * `.arena-prose` scope in globals.css so it re-themes in dark mode. Hidden tests
 * are never passed here.
 */
export default async function ProblemStatement({
  challenge,
}: {
  challenge: ChallengeContent;
}) {
  const [statement, inputFormat, outputFormat, constraints, sampleExplanations] =
    await Promise.all([
      renderMarkdown(challenge.statement),
      renderMarkdown(challenge.inputFormat ?? ""),
      renderMarkdown(challenge.outputFormat ?? ""),
      renderMarkdown(challenge.constraints ?? ""),
      Promise.all(challenge.samples.map((s) => renderMarkdown(s.explanation ?? ""))),
    ]);

  return (
    <div className="arena-prose">
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
