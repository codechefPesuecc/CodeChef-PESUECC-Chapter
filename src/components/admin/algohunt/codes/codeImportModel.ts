export interface CodeLine {
  line: number; // 1-based line in the pasted text
  code: string;
  note: string;
}

/**
 * One code per line, optionally followed by where it's placed: "7FQ2-M8K3, CL-001 · Ground floor, east wing", or
 * cells pasted from a spreadsheet (code first; the other cells become the note). A first line whose
 * first cell is "Code" is a header row and is skipped.
 */
export function parseCodeLines(text: string): CodeLine[] {
  const lines: CodeLine[] = [];
  let seenFirst = false;
  text.split(/\r?\n/).forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = raw.includes("\t") ? raw.split("\t") : splitAtFirstComma(raw);
    const code = cells[0].trim();
    const isHeader = !seenFirst && /^code$/i.test(code);
    seenFirst = true;
    if (isHeader) return;
    const note = cells.slice(1).map((cell) => cell.trim()).filter(Boolean).join(" · ");
    lines.push({ line: idx + 1, code, note });
  });
  return lines;
}

function splitAtFirstComma(raw: string): string[] {
  const at = raw.indexOf(",");
  return at < 0 ? [raw] : [raw.slice(0, at), raw.slice(at + 1)];
}
