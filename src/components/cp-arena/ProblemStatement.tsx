import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Server component — renders the challenge markdown body to styled HTML with no
 * client JS. Element styling lives in the `.arena-prose` scope in globals.css so
 * it re-themes automatically in dark mode via the brand tokens.
 */
export default function ProblemStatement({ body }: { body: string }) {
  return (
    <div className="arena-prose">
      <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
    </div>
  );
}
