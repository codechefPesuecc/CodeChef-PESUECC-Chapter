"use client";

import { useEffect, useState } from "react";

interface Props {
  markdown: string;
}

export default function MarkdownPreview({ markdown }: Props) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!markdown.trim()) {
        setHtml("");
        return;
      }

      try {
        const res = await fetch("/api/monstr/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown }),
        });
        if (res.ok) {
          const data = await res.json();
          setHtml(data.html);
        }
      } catch {
        // Silently fail on preview error
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [markdown]);

  if (!html) return null;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none mt-2 p-3 bg-cream/20 dark:bg-white/5 rounded text-sm">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
