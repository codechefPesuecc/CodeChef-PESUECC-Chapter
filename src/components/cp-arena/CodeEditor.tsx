"use client";

import dynamic from "next/dynamic";
import type { LanguageId } from "./mockData";

// CodeMirror relies on browser APIs, so load it client-side only.
const CodeMirrorEditor = dynamic(() => import("./CodeMirrorEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center bg-[#16110c] font-mono text-sm text-[#8a7355]">
      Loading editor…
    </div>
  ),
});

export default function CodeEditor(props: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
}) {
  return <CodeMirrorEditor {...props} />;
}
