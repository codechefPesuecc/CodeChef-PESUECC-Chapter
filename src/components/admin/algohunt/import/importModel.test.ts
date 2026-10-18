import { describe, expect, it } from "vitest";
import { chunkTests, guessMapping, mapRoster, rowIndexOf, UPLOAD_MAX_CHARS } from "./importModel";

// The real registration form's columns (scripts/generate-algohunt-google-form.gs).
const FORM_HEADERS = [
  "Timestamp", "Team Name", "Total Number of Team Members (Including Leader)",
  "Team Leader - Full Name", "Team Leader - College Email Address", "Team Leader - Phone / WhatsApp Number",
  "Team Leader - SRN / PRN / Roll Number", "Team Leader - College & Campus", "Team Leader - Branch & Year of Study",
  ...[2, 3, 4].flatMap((n) => [`Member ${n} - Full Name`, `Member ${n} - Email Address`, `Member ${n} - Phone Number`,
    `Member ${n} - SRN / PRN / Roll Number`, `Member ${n} - College, Branch & Year`]),
  "Transaction ID / UTR Number",
];

describe("guessMapping", () => {
  it("maps the AlgoHunt registration form, taking the college from 'College & Campus', not the email column", () => {
    const m = guessMapping(FORM_HEADERS, 4);
    expect(m.teamName).toBe("Team Name");
    expect(m.college).toBe("Team Leader - College & Campus");
    expect(m.members[0]).toEqual({
      name: "Team Leader - Full Name", email: "Team Leader - College Email Address", phone: "Team Leader - Phone / WhatsApp Number",
    });
    expect(m.members[3]).toEqual({ name: "Member 4 - Full Name", email: "Member 4 - Email Address", phone: "Member 4 - Phone Number" });
  });
});

describe("mapRoster", () => {
  it("builds teams from rows, skips blank members and rows without a team name, and keeps sheet row numbers", () => {
    const m = guessMapping(FORM_HEADERS, 4);
    const rows = [
      { "Team Name": " Byte  Bandits ", "Team Leader - Full Name": "Asha", "Team Leader - College Email Address": "a@x.edu",
        "Team Leader - College & Campus": "PES ECC", "Member 2 - Full Name": "Ravi", "Member 3 - Full Name": "" },
      { "Team Name": "" },
    ];
    const out = mapRoster(rows, m);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      sourceRow: 2,
      team: { teamName: "Byte Bandits", college: "PES ECC", members: [
        { name: "Asha", email: "a@x.edu", isCaptain: true }, { name: "Ravi", isCaptain: false },
      ] },
    });
  });
});

describe("chunkTests", () => {
  it("puts samples first and keeps every upload within the row and size caps", () => {
    const samples = [{ input: "s", output: "s" }];
    const tests = Array.from({ length: 70 }, (_, i) => ({ input: String(i), output: String(i) }));
    const chunks = chunkTests(samples, tests);
    expect(chunks[0].tests[0]).toEqual({ input: "s", output: "s", isSample: true });
    expect(chunks.map((c) => c.tests.length)).toEqual([30, 30, 11]);
    expect(chunks.map((c) => c.startIdx)).toEqual([0, 30, 60]);
    const big = Array.from({ length: 10 }, () => ({ input: "x".repeat(490_000), output: "y" }));
    for (const chunk of chunkTests([], big)) {
      expect(chunk.tests.reduce((n, t) => n + t.input.length + t.output.length, 0)).toBeLessThanOrEqual(UPLOAD_MAX_CHARS);
    }
  });
});

describe("rowIndexOf", () => {
  it("reads the server's 'Row N' prefix", () => {
    expect(rowIndexOf("Row 3 (Team X): no members.")).toBe(2);
    expect(rowIndexOf("Something else")).toBeNull();
  });
});
