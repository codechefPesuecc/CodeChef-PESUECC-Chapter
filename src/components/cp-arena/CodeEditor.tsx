"use client";

import dynamic from "next/dynamic";
import type { LanguageId } from "./mockData";
import type { IntegrityEvent } from "./useIntegrityMonitor";

// CodeMirror relies on browser APIs, so load it client-side only.
const CodeMirrorEditor = dynamic(() => import("./CodeMirrorEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center bg-[var(--ide-body)] font-mono text-sm text-[var(--ide-ink-dim)]">
      Loading editor…
    </div>
  ),
});

export default function CodeEditor(props: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
  lockClipboard?: boolean;
  onBlocked?: (event: IntegrityEvent) => void;
}) {
  return <CodeMirrorEditor {...props} />;
}
