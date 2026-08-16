import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

/**
 * Renders problem-statement Markdown to sanitized HTML on the server — no
 * client-side Markdown library. `rehype-sanitize` runs last, so the result is
 * safe to inject with `dangerouslySetInnerHTML` even though statements are
 * authored content. GFM (tables, strikethrough, task lists) is supported. The
 * pipeline is pure JS, so it runs on the Cloudflare Workers runtime.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify)
  .freeze();

/** Markdown → sanitized HTML string. */
export async function renderMarkdown(md: string): Promise<string> {
  if (!md) return "";
  const file = await processor.process(md);
  return String(file);
}
