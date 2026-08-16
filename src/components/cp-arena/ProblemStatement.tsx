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
