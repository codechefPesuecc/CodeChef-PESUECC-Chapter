import { describe, expect, it } from "vitest";
import type { AdminTeamDetail, TimelineEntry } from "@/server/algohunt/admin/teams";
import { filterTimeline, revertWarning, stageActions } from "./teamDetailModel";

interface StageSpec {
  n: number;
  solved?: boolean;
  completed?: boolean;
  isFinal?: boolean;
  current?: boolean;
}

function detail(status: string, specs: StageSpec[]): Pick<AdminTeamDetail, "team" | "progress"> {
  const stages = specs.map((s) => ({
    stage: { stageNumber: s.n, isFinal: s.isFinal ?? false },
    progress: s.solved || s.completed ? { challengeSolved: s.solved ?? s.completed, completed: s.completed ?? false } : null,
    current: s.current ?? false,
  }));
  const current = stages.find((s) => s.current) ?? null;
  return {
    team: { status } as AdminTeamDetail["team"],
    progress: { stages, current } as unknown as AdminTeamDetail["progress"],
  };
}

describe("stageActions", () => {
  it("offers unlock on the current question when solved, and revert on the latest completed one", () => {
    const actions = stageActions(detail("CHECKED_IN", [
      { n: 1, completed: true }, { n: 2, completed: true }, { n: 3, solved: true, current: true }, { n: 4 },
    ]));
    expect([...actions.keys()]).toEqual([3, 2]);
    expect(actions.get(3)).toMatchObject({ action: "COMPLETE_STAGE", label: "Unlock next without a code" });
    expect(actions.get(2)).toMatchObject({ action: "REVERT_STAGE", label: "Revert" });
  });

  it("offers a plain complete for an unsolved (broken) current question", () => {
    const actions = stageActions(detail("CHECKED_IN", [{ n: 1, current: true }]));
    expect(actions.get(1)).toMatchObject({ action: "COMPLETE_STAGE", label: "Complete (broken question)" });
  });

  it("labels the final question differently", () => {
    const actions = stageActions(detail("CHECKED_IN", [{ n: 1, completed: true }, { n: 2, solved: true, isFinal: true, current: true }]));
    expect(actions.get(2)).toMatchObject({ action: "COMPLETE_STAGE", label: "Complete final question", isFinal: true });
  });

  it("offers only revert for a finished team and nothing for disqualified or unchecked teams", () => {
    const finished = stageActions(detail("FINISHED", [{ n: 1, completed: true }, { n: 2, completed: true, isFinal: true }]));
    expect([...finished.values()].map((a) => a.action)).toEqual(["REVERT_STAGE"]);
    expect(finished.get(2)?.isFinal).toBe(true);
    expect(stageActions(detail("DISQUALIFIED", [{ n: 1, solved: true, current: true }])).size).toBe(0);
    expect(stageActions(detail("REGISTERED", [{ n: 1 }])).size).toBe(0);
  });
});

describe("revertWarning", () => {
  it("says the code is not returned, and adds the final-question warning", () => {
    expect(revertWarning(false)).toBe("The code they used is NOT returned.");
    expect(revertWarning(true)).toContain("The team will have to solve the final question again.");
  });
});

describe("filterTimeline", () => {
  const entries: TimelineEntry[] = [
    { at: 1, kind: "submission", text: "a" }, { at: 2, kind: "code", text: "b" },
    { at: 3, kind: "progress", text: "c" }, { at: 4, kind: "admin", text: "d" }, { at: 5, kind: "system", text: "e" },
  ];

  it("shows everything under All and one kind otherwise", () => {
    expect(filterTimeline(entries, "all")).toHaveLength(5);
    expect(filterTimeline(entries, "code").map((e) => e.text)).toEqual(["b"]);
    expect(filterTimeline(entries, "admin").map((e) => e.text)).toEqual(["d"]);
  });
});
