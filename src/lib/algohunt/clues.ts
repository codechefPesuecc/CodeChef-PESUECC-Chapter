// Clue book rules shared by the server and the admin page. Pure: no DB access, no secrets.
import type { EventStatus } from "./types";

export const MAX_CLUES = 200;
export const MAX_CLUE_LABEL = 20;
export const MAX_CLUE_TEXT = 1000;
/** How long a found clue stays highlighted on the public clue book. */
export const JUST_FOUND_MS = 3 * 60_000;

export type ClueStatus = "OPEN" | "FOUND" | "UNAVAILABLE";

export interface ClueLine {
  line: number; // 1-based line in the pasted text
  label: string;
  text: string;
}

export interface ClueProblem {
  line: number;
  label: string;
  message: string;
  duplicateOf?: number; // the earlier line with the same label
}

/** What anyone with the link sees: no codes, serials, placement notes, teams or ids. */
export interface PublicClue {
  label: string;
  text: string;
  status: ClueStatus;
  foundAt: number | null;
}

export interface PublicClueBook {
  serverNow: number;
  event: { name: string; status: EventStatus; endsAt: number | null };
  /** False before the hunt starts: no clues are sent then. */
  visible: boolean;
  /** Time is up or the event ended: the statuses are final. */
  final: boolean;
  clues: PublicClue[];
  openCount: number;
  total: number;
}

const SEPARATOR = /\t|:|,|\s*·\s*/;
const HEADER = /^(clue|clue\s*id|label)$/i;

/**
 * One clue per line: the label, then the riddle, split at the first tab, ":", "," or " · ".
 * "CL-012: Where the books sleep" and cells pasted from a sheet both work. Blank lines are skipped,
 * and so is a first line whose first cell is "Clue", "Clue ID" or "Label" (a header row).
 */
export function parseClueLines(text: string): ClueLine[] {
  const lines: ClueLine[] = [];
  let seenFirst = false;
  text.split(/\r?\n/).forEach((raw, idx) => {
    if (!raw.trim()) return;
    const match = SEPARATOR.exec(raw);
    const label = (match ? raw.slice(0, match.index) : raw).trim();
    const rest = match ? raw.slice(match.index + match[0].length) : "";
    const isHeader = !seenFirst && HEADER.test(label);
    seenFirst = true;
    if (isHeader) return;
    // Spare cells from a spreadsheet paste become spaces.
    lines.push({ line: idx + 1, label, text: rest.replace(/\t+/g, " ").trim() });
  });
  return lines;
}

/** Problems per line: missing or over-long label or riddle, spaces in a label, repeated labels. */
export function validateClues(entries: readonly ClueLine[]): ClueProblem[] {
  const problems: ClueProblem[] = [];
  const firstLine = new Map<string, number>();
  for (const { line, label, text } of entries) {
    const add = (message: string, duplicateOf?: number) =>
      problems.push({ line, label, message, ...(duplicateOf ? { duplicateOf } : {}) });
    if (!label) {
      add("Missing the clue label.");
    } else if (/\s/.test(label)) {
      add(text
        ? "The label can't contain spaces."
        : "Put a tab, a colon, a comma or ' · ' between the label and the riddle.");
    } else if (label.length > MAX_CLUE_LABEL) {
      add(`The label is over ${MAX_CLUE_LABEL} characters.`);
    } else if (!text) {
      add("Missing the riddle after the label.");
    }
    if (text.length > MAX_CLUE_TEXT) add(`The riddle is over ${MAX_CLUE_TEXT} characters.`);
    if (!label) continue;
    const key = label.toLowerCase();
    const earlier = firstLine.get(key);
    if (earlier !== undefined) add(`Same label as line ${earlier}.`, earlier);
    else firstLine.set(key, line);
  }
  return problems;
}

/** The leading token of a placement note: "CL-012 · Outside the library" → "CL-012". */
export function placementToken(note: string | null | undefined): string | null {
  const token = (note ?? "").trim().split(/[\s,:·]/, 1)[0];
  return token ? token : null;
}

/** Looks like a clue label ("CL-012", "C7", "12"), so a code with it but no clue is worth flagging. */
export function isClueLikeToken(token: string): boolean {
  return /^[A-Za-z]{0,8}[-_#.]?\d{1,4}[A-Za-z]?$/.test(token);
}

/**
 * A clue is FOUND once any of its codes is used (foundAt = the first use), UNAVAILABLE when every
 * code it has is disabled, and OPEN otherwise, including when no code is linked.
 */
export function deriveClueStatus(
  codes: readonly { status: string; usedAt: number | null }[],
): { status: ClueStatus; foundAt: number | null } {
  const usedAt = codes.filter((c) => c.status === "USED").map((c) => c.usedAt);
  if (usedAt.length > 0) {
    const times = usedAt.filter((t): t is number => t !== null);
    return { status: "FOUND", foundAt: times.length > 0 ? Math.min(...times) : null };
  }
  if (codes.length > 0 && codes.every((c) => c.status === "DISABLED")) {
    return { status: "UNAVAILABLE", foundAt: null };
  }
  return { status: "OPEN", foundAt: null };
}

/** Label order: CL-2 before CL-10. */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/**
 * The public page's sections: open clues to go after (label order), then the rest. Clues found in
 * the last 3 minutes lead the found section, newest first; the others keep label order.
 */
export function splitClueBook(
  clues: readonly PublicClue[],
  serverNow: number,
): { open: PublicClue[]; justFound: PublicClue[]; done: PublicClue[] } {
  const byLabel = [...clues].sort((a, b) => compareLabels(a.label, b.label));
  const isJustFound = (c: PublicClue) =>
    c.status === "FOUND" && c.foundAt !== null && serverNow - c.foundAt < JUST_FOUND_MS;
  return {
    open: byLabel.filter((c) => c.status === "OPEN"),
    justFound: byLabel.filter(isJustFound).sort((a, b) => (b.foundAt ?? 0) - (a.foundAt ?? 0)),
    done: byLabel.filter((c) => c.status !== "OPEN" && !isJustFound(c)),
  };
}

/** The page teammates open on their phones. No team login needed. */
export function clueBookPath(eventSlug: string): string {
  return `/algohunt/clues?event=${encodeURIComponent(eventSlug)}`;
}
