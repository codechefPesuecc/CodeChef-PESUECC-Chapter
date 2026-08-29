import type { Transaction } from "@uiw/react-codemirror";

/**
 * State-layer paste detection for the locked Arena editor.
 *
 * The DOM `paste`/`drop` handlers are the first line, but they can be disabled
 * from devtools. These helpers run inside a CodeMirror `transactionFilter`, one
 * layer deeper: a paste still produces a transaction, so the filter can cancel
 * outside content even when the DOM guard has been tampered with. Not a hard
 * guarantee (a determined user can strip any client extension) — the value is
 * that the common bypass no longer works silently, and every blocked paste is
 * still recorded in the server-side flag count.
 */

/** Normalize line endings so clipboard text compares equal across platforms. */
export function normalizeClip(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

/** All text a transaction inserts, concatenated across its changes. */
export function insertedText(tr: Transaction): string {
  let out = "";
  tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    out += inserted.toString();
  });
  return out;
}

/**
 * True when a transaction pastes (or drops) text that did NOT originate from this
 * editor — i.e. outside content that must be blocked. `isUserEvent("input.paste")`
 * matches both `input.paste` and the hierarchical `input.paste.drop`, so a drag-in
 * is caught as well. `allowed` is the recent internal-copy history.
 */
export function isDisallowedPaste(tr: Transaction, allowed: readonly string[]): boolean {
  if (!tr.docChanged || !tr.isUserEvent("input.paste")) return false;
  const text = normalizeClip(insertedText(tr));
  return text.length > 0 && !allowed.includes(text);
}

/** Longer than any plausible single keystroke or IME commit. A one-shot insert
 *  this large is a paste or a programmatic injection, never human typing (the
 *  editor has autocomplete disabled). */
export const BULK_INSERT_THRESHOLD = 40;

/**
 * True when a transaction injects a large block of outside text as a single
 * "typing" edit rather than a paste — the method most AI browser assistants /
 * extensions use (`document.execCommand("insertText", …)`), which CodeMirror
 * records as `input.type`. Excludes IME composition (`input.type.compose`) so a
 * long CJK commit from an honest student is never flagged, and excludes text
 * already copied from this editor. Undo/redo are `undo`/`redo` user events (not
 * under `input`), so restoring your own work is inherently safe.
 */
export function isBulkInjection(tr: Transaction, allowed: readonly string[]): boolean {
  if (!tr.docChanged) return false;
  if (!tr.isUserEvent("input.type") || tr.isUserEvent("input.type.compose")) return false;
  const text = normalizeClip(insertedText(tr));
  return text.length >= BULK_INSERT_THRESHOLD && !allowed.includes(text);
}
