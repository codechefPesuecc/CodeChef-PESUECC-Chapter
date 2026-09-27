import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  isDisallowedPaste,
  isBulkInjection,
  insertedText,
  normalizeClip,
  BULK_INSERT_THRESHOLD,
  isRoboticCadence,
  CadenceTracker,
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

describe("isRoboticCadence", () => {
  it("detects fixed 200ms auto-typer (Paste Typer extension)", () => {
    const fixed200ms = Array(15).fill(200);
    expect(isRoboticCadence(fixed200ms)).toBe(true);
  });

  it("detects fixed 50ms auto-typer", () => {
    const fixed50ms = Array(15).fill(50);
    expect(isRoboticCadence(fixed50ms)).toBe(true);
  });

  it("detects 200ms auto-typer with tiny timer jitter (±3ms)", () => {
    const jitter = [201, 199, 202, 200, 198, 200, 201, 199, 200, 202, 198, 201, 200, 199, 200];
    expect(isRoboticCadence(jitter)).toBe(true);
  });

  it("detects superhuman burst macro (< 35ms)", () => {
    const macro = [20, 15, 25, 10, 18, 22, 16, 24, 19, 15, 21, 23];
    expect(isRoboticCadence(macro)).toBe(true);
  });

  it("does not flag natural variable human typing cadence", () => {
    // Human keystroke intervals fluctuate widely between keys, combinations, and thinking
    const humanTyping = [120, 85, 240, 65, 310, 95, 180, 75, 410, 110, 290, 80, 160, 220, 90];
    expect(isRoboticCadence(humanTyping)).toBe(false);
  });

  it("does not flag sequences shorter than CADENCE_WINDOW_MIN", () => {
    const shortBurst = Array(5).fill(200);
    expect(isRoboticCadence(shortBurst)).toBe(false);
  });

  it("does not flag very slow typing (> 450ms)", () => {
    const slowTyping = Array(15).fill(600);
    expect(isRoboticCadence(slowTyping)).toBe(false);
  });
});

describe("CadenceTracker", () => {
  it("flags a continuous stream of simulated keystrokes at 200ms with varied code", () => {
    const tracker = new CadenceTracker();
    let flagged = false;
    let time = 1000;
    const codeSnippet = "import subprocess\nimport sys\nprint('hello')";

    for (let i = 0; i < codeSnippet.length; i++) {
      time += 200;
      if (tracker.record(codeSnippet[i], time)) {
        flagged = true;
        break;
      }
    }

    expect(flagged).toBe(true);
  });

  it("does not flag holding down a key (key-repeat for comments / spaces)", () => {
    const tracker = new CadenceTracker();
    let flagged = false;
    let time = 1000;

    // Fast OS key-repeat holding down "-" 30 times at ~33ms interval
    for (let i = 0; i < 30; i++) {
      time += 33;
      if (tracker.record("-", time)) {
        flagged = true;
        break;
      }
    }

    expect(flagged).toBe(false);
  });

  it("does not flag normal human typing with natural pauses and varied speeds", () => {
    const tracker = new CadenceTracker();
    let flagged = false;
    let time = 1000;
    const humanDelays = [110, 75, 280, 90, 350, 80, 190, 60, 420, 105, 300, 85, 150, 230, 95];
    const letters = "def solve(arr):";

    for (let i = 0; i < humanDelays.length; i++) {
      time += humanDelays[i];
      if (tracker.record(letters[i] || "x", time)) {
        flagged = true;
        break;
      }
    }

    expect(flagged).toBe(false);
  });

  it("resets interval streak on thinking pause (> 1500ms)", () => {
    const tracker = new CadenceTracker();
    let time = 1000;
    const text = "abcdefghijklmnopqrstuvwxyz";

    // 8 robotic keystrokes (not enough to flag yet, min is 12)
    for (let i = 0; i < 8; i++) {
      time += 200;
      expect(tracker.record(text[i], time)).toBe(false);
    }

    // Long thinking pause
    time += 2000;
    expect(tracker.record(" ", time)).toBe(false);

    // Another 5 keystrokes (only 5 since pause, total in window < 12)
    for (let i = 0; i < 5; i++) {
      time += 200;
      expect(tracker.record(text[8 + i], time)).toBe(false);
    }
  });
});

