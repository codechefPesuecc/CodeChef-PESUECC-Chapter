import { describe, expect, it } from "vitest";
import type { AdminTeamRow } from "@/server/algohunt/admin/teams";
import { filterWaiting, formatAgo, sortTeams } from "./teamsModel";

const NOW = 1_000_000_000;

function team(code: string, over: Partial<AdminTeamRow> = {}): AdminTeamRow {
  return {
    id: code, code, name: code, college: null, status: "CHECKED_IN", currentQuestion: 1, questionsSolved: 0,
    waitingForCode: false, waitingSince: null, totalStages: 6, lastActivityAt: null, checkedInAt: null,
    finishedAt: null, ...over,
  };
}

describe("formatAgo", () => {
  it("reads seconds, minutes, hours and days", () => {
    expect(formatAgo(NOW - 5_000, NOW)).toBe("just now");
    expect(formatAgo(NOW - 2 * 60_000, NOW)).toBe("2m ago");
    expect(formatAgo(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    expect(formatAgo(NOW - 50 * 3_600_000, NOW)).toBe("2d ago");
    expect(formatAgo(NOW + 10_000, NOW)).toBe("just now");
  });
});

describe("sortTeams", () => {
  const rows = [
    team("AH2-T002", { questionsSolved: 4, lastActivityAt: NOW - 1_000 }),
    team("AH2-T001", { questionsSolved: 4 }),
    team("AH2-T003", { questionsSolved: 1, lastActivityAt: NOW - 9_000 }),
  ];

  it("sorts numbers both ways and breaks ties by team code", () => {
    expect(sortTeams(rows, "questionsSolved", "desc", NOW).map((r) => r.code)).toEqual(["AH2-T001", "AH2-T002", "AH2-T003"]);
    expect(sortTeams(rows, "questionsSolved", "asc", NOW).map((r) => r.code)).toEqual(["AH2-T003", "AH2-T001", "AH2-T002"]);
  });

  it("keeps rows with no value last in either direction", () => {
    expect(sortTeams(rows, "lastActivityAt", "asc", NOW).map((r) => r.code)).toEqual(["AH2-T003", "AH2-T002", "AH2-T001"]);
    expect(sortTeams(rows, "lastActivityAt", "desc", NOW).map((r) => r.code)).toEqual(["AH2-T002", "AH2-T003", "AH2-T001"]);
  });

  it("does not change the input array", () => {
    const copy = [...rows];
    sortTeams(rows, "code", "asc", NOW);
    expect(rows).toEqual(copy);
  });

  it("sorts by how long a team has waited, longest first when descending", () => {
    const waiting = [
      team("A", { waitingForCode: true, waitingSince: NOW - 60_000 }),
      team("B", { waitingForCode: true, waitingSince: NOW - 600_000 }),
      team("C"),
    ];
    expect(sortTeams(waiting, "waiting", "desc", NOW).map((r) => r.code)).toEqual(["B", "A", "C"]);
  });
});

describe("filterWaiting", () => {
  it("keeps only teams waiting for a code when asked", () => {
    const rows = [team("A", { waitingForCode: true }), team("B")];
    expect(filterWaiting(rows, true).map((r) => r.code)).toEqual(["A"]);
    expect(filterWaiting(rows, false).map((r) => r.code)).toEqual(["A", "B"]);
  });
});
