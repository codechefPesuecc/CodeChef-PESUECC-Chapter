"use client";

import { useEffect, useState } from "react";

interface Props {
  markdown: string;
}

export default function MarkdownPreview({ markdown }: Props) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!markdown.trim()) {
        setHtml("");
        return;
      }

      try {
        // Render in the browser using the same pipeline as the server, so the live
        // preview matches the real page — but without a Worker request on every
        // keystroke. The server-side render (the unified/rehype stack) was heavy
        // enough to trip Cloudflare's per-request limits on the free plan.
        const { renderMarkdown } = await import("@/lib/markdown");
        const rendered = await renderMarkdown(markdown);
        if (active) setHtml(rendered);
      } catch {
        // Silently fail on preview error
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [markdown]);

  if (!html) return null;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none mt-2 p-3 bg-cream/20 dark:bg-white/5 rounded text-sm">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
