import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  isDisallowedPaste,
  isBulkInjection,
  insertedText,
  normalizeClip,
  BULK_INSERT_THRESHOLD,
} from "./pasteGuard";

/** Build a transaction that inserts `insert` at the end of `doc`, tagged with a
 *  CodeMirror user-event (e.g. "input.paste", "input.paste.drop", "input.type"). */
function tx(doc: string, insert: string, userEvent: string) {
  const state = EditorState.create({ doc });
  return state.update({ changes: { from: doc.length, insert }, userEvent });
}

describe("isDisallowedPaste", () => {
  it("blocks an outside paste (not in the internal-copy history)", () => {
    expect(isDisallowedPaste(tx("code", "outside solution", "input.paste"), [])).toBe(true);
  });

  it("allows a paste of text copied from this editor", () => {
    expect(isDisallowedPaste(tx("code", "my snippet", "input.paste"), ["my snippet"])).toBe(false);
  });

  it("blocks a drag-and-drop of outside text (input.paste.drop)", () => {
    // This is the case a strict `=== "input.paste"` check would have missed.
    expect(isDisallowedPaste(tx("code", "dropped code", "input.paste.drop"), [])).toBe(true);
  });

  it("does not treat normal typing as a paste", () => {
    expect(isDisallowedPaste(tx("code", "x", "input.type"), [])).toBe(false);
  });

  it("normalizes CRLF when matching the internal history", () => {
    expect(isDisallowedPaste(tx("code", "line1\r\nline2", "input.paste"), ["line1\nline2"])).toBe(false);
  });

  it("ignores an empty paste", () => {
    expect(isDisallowedPaste(tx("code", "", "input.paste"), [])).toBe(false);
  });
});

describe("isBulkInjection", () => {
  const big = "x".repeat(60);

  it("blocks a large one-shot typing insert (execCommand / Elements-panel DOM edit)", () => {
    // Both AI-extension injection and direct DOM edits reconcile to a big input.type.
    expect(isBulkInjection(tx("code", big, "input.type"), [])).toBe(true);
  });

  it("does not flag normal single-character typing", () => {
    expect(isBulkInjection(tx("code", "a", "input.type"), [])).toBe(false);
  });

  it("respects the threshold boundary", () => {
    expect(isBulkInjection(tx("", "y".repeat(BULK_INSERT_THRESHOLD), "input.type"), [])).toBe(true);
    expect(isBulkInjection(tx("", "y".repeat(BULK_INSERT_THRESHOLD - 1), "input.type"), [])).toBe(false);
  });

  it("excludes IME composition (a long CJK commit is not flagged)", () => {
    expect(isBulkInjection(tx("code", big, "input.type.compose"), [])).toBe(false);
  });

  it("allows re-inserting the candidate's own copied block", () => {
    expect(isBulkInjection(tx("code", big, "input.type"), [big])).toBe(false);
  });

  it("does not treat undo/redo as injection", () => {
    expect(isBulkInjection(tx("code", big, "undo"), [])).toBe(false);
    expect(isBulkInjection(tx("code", big, "redo"), [])).toBe(false);
  });

  it("leaves pastes to isDisallowedPaste (not double-handled here)", () => {
    expect(isBulkInjection(tx("code", big, "input.paste"), [])).toBe(false);
  });
});

describe("insertedText / normalizeClip", () => {
  it("extracts the inserted text from a transaction", () => {
    expect(insertedText(tx("ab", "XYZ", "input.paste"))).toBe("XYZ");
  });
  it("collapses CRLF and lone CR to LF", () => {
    expect(normalizeClip("a\r\nb\rc")).toBe("a\nb\nc");
  });
});
