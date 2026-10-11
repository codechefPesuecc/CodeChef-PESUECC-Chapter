import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, EVENT_TRANSITIONS } from "@/lib/algohunt/types";
import { FLAG_ROWS, deriveReadiness, readinessIssues, transitionOptions } from "./controlModel";

const stage = (stageNumber: number, over: Partial<{ isFinal: boolean; verified: boolean }> = {}) => ({
  stageNumber, isFinal: false, verified: true, ...over,
});

describe("transitionOptions", () => {
  it("offers exactly the moves the engine allows, for every status", () => {
    for (const status of EVENT_STATUSES) {
      expect(transitionOptions(status).map((o) => o.to).sort()).toEqual([...EVENT_TRANSITIONS[status]].sort());
    }
  });

  it("uses the organizers' wording for the moves used during the event", () => {
    const label = (from: Parameters<typeof transitionOptions>[0], to: string) =>
      transitionOptions(from).find((o) => o.to === to)?.label;
    expect(label("READY", "LIVE")).toBe("START EVENT");
    expect(label("LIVE", "PAUSED")).toBe("PAUSE");
    expect(label("PAUSED", "LIVE")).toBe("RESUME");
    expect(label("LIVE", "ENDED")).toBe("END EVENT");
    expect(label("PAUSED", "ENDED")).toBe("END EVENT");
  });

  it("puts the big buttons first and marks the final moves as dangerous", () => {
    const live = transitionOptions("LIVE");
    expect(live.every((o) => o.primary)).toBe(true);
    expect(live.find((o) => o.to === "ENDED")?.danger).toBe(true);
    expect(live.find((o) => o.to === "PAUSED")?.danger).toBe(false);
    const draft = transitionOptions("DRAFT");
    expect(draft.every((o) => !o.primary)).toBe(true);
    expect(transitionOptions("ENDED")[0]).toMatchObject({ to: "ARCHIVED", danger: true });
  });

  it("says what START does in plain words", () => {
    const start = transitionOptions("READY").find((o) => o.to === "LIVE");
    expect(start?.consequences).toContain("open Question 1 immediately");
    expect(start?.consequences).toContain("start time is recorded");
  });

  it("offers nothing from ARCHIVED", () => {
    expect(transitionOptions("ARCHIVED")).toEqual([]);
  });
});

describe("deriveReadiness", () => {
  it("counts questions, unverified ones, and a correct final question", () => {
    const r = deriveReadiness([stage(1), stage(2), stage(3, { isFinal: true })], 50, 38);
    expect(r).toEqual({ stages: 3, challengesUnverified: 0, finalStageOk: true, activeCodes: 50, checkedInTeams: 38 });
  });

  it("flags unverified questions", () => {
    const r = deriveReadiness([stage(1, { verified: false }), stage(2, { isFinal: true })], 5, 1);
    expect(r.challengesUnverified).toBe(1);
  });

  it("needs exactly one final question and it must be the highest number", () => {
    expect(deriveReadiness([stage(1), stage(2)], 1, 1).finalStageOk).toBe(false);
    expect(deriveReadiness([stage(1, { isFinal: true }), stage(2)], 1, 1).finalStageOk).toBe(false);
    expect(deriveReadiness([stage(1, { isFinal: true }), stage(2, { isFinal: true })], 1, 1).finalStageOk).toBe(false);
    expect(deriveReadiness([stage(1), stage(2, { isFinal: true })], 1, 1).finalStageOk).toBe(true);
    expect(deriveReadiness([], 1, 1).finalStageOk).toBe(false);
  });
});

describe("readinessIssues", () => {
  const ready = { stages: 6, challengesUnverified: 0, finalStageOk: true, activeCodes: 50, checkedInTeams: 38 };

  it("is empty when everything is ready", () => {
    expect(readinessIssues(ready)).toEqual([]);
  });

  it("names each problem", () => {
    expect(readinessIssues({ ...ready, activeCodes: 0 })).toEqual(["There are 0 active codes."]);
    expect(readinessIssues({ ...ready, challengesUnverified: 2 })[0]).toContain("2 questions are not verified");
    expect(readinessIssues({ ...ready, challengesUnverified: 1 })[0]).toContain("1 question is not verified");
    expect(readinessIssues({ ...ready, finalStageOk: false })[0]).toContain("final question");
    expect(readinessIssues({ ...ready, checkedInTeams: 0 })).toEqual(["No team is checked in."]);
  });

  it("reports an empty event once, without piling on question errors", () => {
    const issues = readinessIssues({ stages: 0, challengesUnverified: 0, finalStageOk: false, activeCodes: 0, checkedInTeams: 0 });
    expect(issues).toEqual(["No questions are set up yet.", "There are 0 active codes.", "No team is checked in."]);
  });
});

describe("FLAG_ROWS", () => {
  it("covers the three emergency switches with copy for both directions", () => {
    expect(FLAG_ROWS.map((f) => f.key)).toEqual(["submissionsEnabled", "codesEnabled", "leaderboardVisible"]);
    for (const row of FLAG_ROWS) {
      expect(row.turnOff.consequences.length).toBeGreaterThan(10);
      expect(row.turnOn.consequences.length).toBeGreaterThan(10);
    }
  });
});
