"use client";

import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import type { LanguageId } from "./mockData";

const extensionFor = (language: LanguageId) =>
  language === "python" ? python() : language === "java" ? java() : cpp();

/**
 * The actual CodeMirror instance. Touches the DOM on init, so it is only ever
 * imported through the `ssr: false` dynamic wrapper in CodeEditor.
 */
export default function CodeMirrorEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="dark"
      height="460px"
      extensions={[extensionFor(language)]}
      basicSetup={{
        foldGutter: false,
        autocompletion: false,
        highlightActiveLine: true,
        tabSize: 4,
      }}
      style={{ fontSize: "13px" }}
    />
  );
}
