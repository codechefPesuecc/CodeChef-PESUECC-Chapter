import { describe, expect, it } from "vitest";
import { deriveStageState } from "./stage-state";

describe("deriveStageState", () => {
  it.each([
    [{ accessible: false, hasSubmission: false, challengeSolved: false, completed: false }, "LOCKED"],
    [{ accessible: true, hasSubmission: false, challengeSolved: false, completed: false }, "AVAILABLE"],
    [{ accessible: true, hasSubmission: true, challengeSolved: false, completed: false }, "IN_PROGRESS"],
    [{ accessible: true, hasSubmission: true, challengeSolved: true, completed: false }, "CODE_PENDING"],
    [{ accessible: false, hasSubmission: true, challengeSolved: true, completed: true }, "COMPLETED"],
  ] as const)("derives %s as %s", (input, expected) => {
    expect(deriveStageState(input)).toBe(expected);
  });

  it("keeps an inaccessible solved question locked", () => {
    expect(deriveStageState({
      accessible: false,
      hasSubmission: true,
      challengeSolved: true,
      completed: false,
    })).toBe("LOCKED");
  });
});
