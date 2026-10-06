import type { StageState } from "./types";

export function deriveStageState(input: {
  accessible: boolean;
  hasSubmission: boolean;
  challengeSolved: boolean;
  completed: boolean;
}): StageState {
  if (input.completed) return "COMPLETED";
  if (!input.accessible) return "LOCKED";
  if (input.challengeSolved) return "CODE_PENDING";
  if (input.hasSubmission) return "IN_PROGRESS";
  return "AVAILABLE";
}
