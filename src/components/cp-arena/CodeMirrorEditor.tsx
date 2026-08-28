"use client";

import { useRef } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { StreamLanguage } from "@codemirror/language";
import { csharp } from "@codemirror/legacy-modes/mode/clike";
import type { LanguageId } from "./mockData";
import type { IntegrityEvent } from "./useIntegrityMonitor";
import { useThemeMode } from "./useThemeMode";

// C and C++ share the cpp highlighter; Kotlin/C# use the legacy clike modes;
// Zig has no CodeMirror grammar yet, so it falls back to a plain editor.
const extensionFor = (language: LanguageId) => {
  switch (language) {
    case "python":
    case "pypy3":
      return python();
    case "java":
      return java();
    case "csharp":
      return StreamLanguage.define(csharp);
    case "javascript":
      return javascript();
    case "typescript":
      return javascript({ typescript: true });
    case "go":
      return go();
    case "rust":
      return rust();
    case "sql":
    case "zig":
      return [];
    case "c":
    case "cpp":
    default:
      return cpp();
  }
};

/**
 * The actual CodeMirror instance. Touches the DOM on init, so it is only ever
 * imported through the `ssr: false` dynamic wrapper in CodeEditor.
 *
 * When `lockClipboard` is set, copy/cut are captured so the candidate can move
 * their own code around, but a paste whose text did NOT originate from this editor
 * (an outside solution) is blocked and reported via `onBlocked`. Right-click and
 * drag-and-drop stay blocked too, since a drop is another way to inject outside text.
 */
export default function CodeMirrorEditor({
  value,
  onChange,
  language,
  lockClipboard = false,
  onBlocked,
  fullscreen = false,
}: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
  lockClipboard?: boolean;
  onBlocked?: (event: IntegrityEvent) => void;
  /** Maximized editor: fill the container height instead of the fixed 460px. */
  fullscreen?: boolean;
}) {
  const mode = useThemeMode();

  // Snapshots of text copied/cut FROM this editor. A paste is allowed only when the
  // incoming clipboard text matches one of these — i.e. it came from here — so the
  // candidate can move their own code around but can't paste in an outside solution.
  // We keep a short history rather than a single value so the OS clipboard history
  // (e.g. Windows Win+V re-pasting an earlier copy) doesn't trip a false block.
  const internalCopies = useRef<string[]>([]);
  const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
  const remember = (text: string) => {
    const n = normalize(text);
    if (!n) return;
    const next = internalCopies.current.filter((t) => t !== n);
    next.push(n);
    internalCopies.current = next.slice(-15); // keep only the most recent handful
  };
  // What CodeMirror would put on the clipboard: the selected text, or the whole
  // current line when the selection is empty (mirrors the default copy behaviour).
  const copyText = (view: EditorView) => {
    const { state } = view;
    return state.selection.ranges
      .map((r) => (r.empty ? state.doc.lineAt(r.head).text : state.sliceDoc(r.from, r.to)))
      .join("\n");
  };

  const guards = lockClipboard
    ? [
        // The ref is only read inside these DOM event handlers (at event time),
        // never during render — safe, but the rule can't see the deferred closures.
        // eslint-disable-next-line react-hooks/refs
        EditorView.domEventHandlers({
          paste(event) {
            const incoming = normalize(event.clipboardData?.getData("text") ?? "");
            // Only accept clipboard content that was copied from within this editor;
            // let CodeMirror insert it natively. Anything else is outside text.
            if (incoming && internalCopies.current.includes(incoming)) {
              return false;
            }
            event.preventDefault();
            onBlocked?.("paste");
            return true;
          },
          copy(event, view) {
            // Take control so the snapshot exactly equals what lands on the clipboard.
            const text = copyText(view);
            event.clipboardData?.setData("text/plain", text);
            event.preventDefault();
            remember(text);
            return true;
          },
          cut(event, view) {
            const text = copyText(view);
            event.clipboardData?.setData("text/plain", text);
            event.preventDefault();
            remember(text);
            // Remove the selection (a cut with no selection leaves the doc as-is).
            if (view.state.selection.ranges.some((r) => !r.empty)) {
              view.dispatch(view.state.replaceSelection(""));
            }
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
      // In fullscreen the wrapper is a flex child with a definite height, so the
      // editor fills it (100%); otherwise it keeps the standard fixed height.
      height={fullscreen ? "100%" : "460px"}
      className={fullscreen ? "h-full" : undefined}
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
