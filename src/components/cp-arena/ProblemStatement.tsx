import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChallengeContent } from "@/lib/challenges";

/**
 * Server component — renders a challenge's public content (statement + structured
 * sections) to styled HTML with no client JS. Prose fields are Markdown; element
 * styling lives in the `.arena-prose` scope in globals.css so it re-themes in
 * dark mode. Hidden tests are never passed here.
 */
function Md({ children }: { children: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>;
}

export default function ProblemStatement({
  challenge,
}: {
  challenge: ChallengeContent;
}) {
  return (
    <div className="arena-prose">
      <Md>{challenge.statement}</Md>

      {challenge.inputFormat && (
        <>
          <h2>Input Format</h2>
          <Md>{challenge.inputFormat}</Md>
        </>
      )}

      {challenge.outputFormat && (
        <>
          <h2>Output Format</h2>
          <Md>{challenge.outputFormat}</Md>
        </>
      )}

      {challenge.constraints && (
        <>
          <h2>Constraints</h2>
          <Md>{challenge.constraints}</Md>
        </>
      )}

      {challenge.samples.map((sample, i) => (
        <section key={i}>
          <h2>
            Sample{challenge.samples.length > 1 ? ` ${i + 1}` : ""}
          </h2>
          <div className="arena-io-label">Input</div>
          <pre>{sample.input.replace(/\n+$/, "")}</pre>
          <div className="arena-io-label">Output</div>
          <pre>{sample.output.replace(/\n+$/, "")}</pre>
          {sample.explanation && (
            <>
              <h3>Explanation</h3>
              <Md>{sample.explanation}</Md>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
