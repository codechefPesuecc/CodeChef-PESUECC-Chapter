"use client";

import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import type { LanguageId } from "./mockData";
import type { IntegrityEvent } from "./useIntegrityMonitor";
import { useThemeMode } from "./useThemeMode";

const extensionFor = (language: LanguageId) =>
  language === "python" ? python() : language === "java" ? java() : cpp();

/**
 * The actual CodeMirror instance. Touches the DOM on init, so it is only ever
 * imported through the `ssr: false` dynamic wrapper in CodeEditor.
 *
 * When `lockClipboard` is set, paste/copy/cut/drag are blocked inside the editor
 * and each attempt is reported via `onBlocked` for the integrity monitor.
 */
export default function CodeMirrorEditor({
  value,
  onChange,
  language,
  lockClipboard = false,
  onBlocked,
}: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
  lockClipboard?: boolean;
  onBlocked?: (event: IntegrityEvent) => void;
}) {
  const mode = useThemeMode();
  const guards = lockClipboard
    ? [
        EditorView.domEventHandlers({
          paste(event) {
            event.preventDefault();
            onBlocked?.("paste");
            return true;
          },
          copy(event) {
            event.preventDefault();
            onBlocked?.("copy");
            return true;
          },
          cut(event) {
            event.preventDefault();
            onBlocked?.("cut");
            return true;
          },
          contextmenu(event) {
            event.preventDefault();
            onBlocked?.("context-menu");
            return true;
          },
          dragstart(event) {
            event.preventDefault();
            return true;
          },
          drop(event) {
            event.preventDefault();
            return true;
          },
        }),
      ]
    : [];

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={mode}
      height="460px"
      extensions={[extensionFor(language), ...guards]}
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
