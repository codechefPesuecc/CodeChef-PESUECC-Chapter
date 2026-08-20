import * as XLSX from "xlsx";

export interface ParticipantResult {
  username: string;
  name: string | null;
  srn: string;
  problemsSolved: number;
  submissions: Array<{
    problemId: string;
    problemTitle: string;
    bestStatus: string;
    submissionCount: number;
  }>;
}

/**
 * Generate an Excel workbook with contest results.
 * Returns a Buffer containing the XLSX file data.
 */
export function generateContestExcel(params: {
  contestTitle: string;
  problems: Array<{ id: string; title: string }>;
  results: ParticipantResult[];
}): Buffer {
  const { contestTitle, problems, results } = params;

  // Build header row
  const headers = [
    "Username",
    "Name",
    "SRN",
    "Problems Solved",
    ...problems.map((p) => p.title),
  ];

  // Build data rows
  const rows = results.map((r) => {
    const row = [r.username, r.name || "", r.srn, r.problemsSolved];

    // Add per-problem columns
    for (const problem of problems) {
      const submission = r.submissions.find((s) => s.problemId === problem.id);
      if (submission) {
        row.push(`${submission.bestStatus} (${submission.submissionCount})`);
      } else {
        row.push("—");
      }
    }

    return row;
  });

  // Create worksheet
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-size columns
  const colWidths = headers.map((h) => ({
    wch: Math.max(h.length, 12),
  }));
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  // Generate buffer
  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}
