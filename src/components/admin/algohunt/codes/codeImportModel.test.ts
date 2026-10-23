import { describe, expect, it } from "vitest";
import { parseCodeLines } from "./codeImportModel";

describe("parseCodeLines", () => {
  it("reads a code and an optional note per line, keeping line numbers and skipping blanks", () => {
    expect(parseCodeLines("7FQ2-M8K3, CL-001 · Ground floor, east wing\n\n  9KD4-W2PX  \n3HVT-7XQA,East wing, by the steps\n")).toEqual([
      { line: 1, code: "7FQ2-M8K3", note: "CL-001 · Ground floor, east wing" },
      { line: 3, code: "9KD4-W2PX", note: "" },
      { line: 4, code: "3HVT-7XQA", note: "East wing, by the steps" },
    ]);
  });

  it("reads cells pasted from a sheet, joining the rest into the note, and skips a Code header", () => {
    expect(parseCodeLines("Code\tClue\tLocation\r\n7FQ2-M8K3\tCL-001\tGround floor, east wing\r\n9KD4-W2PX\t\t")).toEqual([
      { line: 2, code: "7FQ2-M8K3", note: "CL-001 · Ground floor, east wing" },
      { line: 3, code: "9KD4-W2PX", note: "" },
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(parseCodeLines(" \n\t\n")).toEqual([]);
  });
});
