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

/** Minimum number of consecutive inputs needed to calculate cadence metrics. */
export const CADENCE_WINDOW_MIN = 12;
/** Auto-typer timer variance limit: standard deviation under 12ms at steady speed. */
export const CADENCE_MAX_STDDEV = 12;
/** Upper bound for mean interval of an active simulated typer (e.g. 200-400ms). */
export const CADENCE_MAX_MEAN = 450;
/** Single interval above this is considered a human thinking pause and resets the continuous burst. */
export const CADENCE_BURST_PAUSE_MS = 1500;

/**
 * Calculates standard deviation and mean for a series of inter-keystroke intervals (IKIs).
 * Returns true if the cadence exhibits robotic, metronomic regularity characteristic of
 * auto-typers / paste-typer browser extensions.
 */
export function isRoboticCadence(intervals: readonly number[]): boolean {
  if (intervals.length < CADENCE_WINDOW_MIN) return false;

  const n = intervals.length;
  const mean = intervals.reduce((sum, val) => sum + val, 0) / n;

  // Superhuman continuous macro typing (< 35ms per character sustained across the window)
  if (mean < 35) return true;

  // If average speed is slower than plausible auto-typer range (e.g. > 450ms/char), not flagged
  if (mean > CADENCE_MAX_MEAN) return false;

  // Sample variance and standard deviation
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  // Auto-typers using setInterval/setTimeout or fixed delays have near-zero jitter (stdDev < 12ms)
  return stdDev <= CADENCE_MAX_STDDEV;
}

/**
 * State tracker for continuous typing cadence in the editor.
 */
export class CadenceTracker {
  private intervals: number[] = [];
  private chars: string[] = [];
  private lastTime: number | null = null;
  private maxWindow: number;

  constructor(maxWindow = 30) {
    this.maxWindow = maxWindow;
  }

  /**
   * Records a keystroke/transaction timestamp and the inserted text snippet.
   * Returns true if robotic cadence is detected.
   */
  record(
    char = "",
    now: number = typeof performance !== "undefined" ? performance.now() : Date.now(),
  ): boolean {
    if (this.lastTime === null) {
      this.lastTime = now;
      if (char) this.chars = [char];
      return false;
    }

    const delta = now - this.lastTime;
    this.lastTime = now;

    // A thinking pause breaks the continuous burst
    if (delta > CADENCE_BURST_PAUSE_MS) {
      this.intervals = [];
      this.chars = [];
      return false;
    }

    // Ignore negative or identical timestamps from batch processing
    if (delta < 1) return false;

    this.intervals.push(delta);
    if (char) this.chars.push(char);

    if (this.intervals.length > this.maxWindow) {
      this.intervals.shift();
    }
    if (this.chars.length > this.maxWindow) {
      this.chars.shift();
    }

    // If holding down a single key (e.g. key-repeat for "------", spaces, or "00000"),
    // character variety is low (< 4 distinct characters), which is legitimate human behavior.
    if (this.chars.length >= CADENCE_WINDOW_MIN) {
      const uniqueChars = new Set(this.chars);
      if (uniqueChars.size < 4) {
        return false;
      }
    }

    return isRoboticCadence(this.intervals);
  }

  reset(): void {
    this.intervals = [];
    this.chars = [];
    this.lastTime = null;
  }
}

