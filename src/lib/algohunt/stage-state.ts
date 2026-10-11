import type { StageState } from "./types";

/**
 * Derives the UI state of a stage from its stored fact columns.
 * Priority order (contract §9):
 * 1. completed → COMPLETED
 * 2. !accessible → LOCKED
 * 3. challengeSolved → CODE_PENDING
 * 4. hasSubmission → IN_PROGRESS
 * 5. else AVAILABLE
 */
export function deriveStageState(input: {
  accessible: boolean;
  hasSubmission: boolean;
  challengeSolved: boolean;
  completed: boolean;
}): StageState {
  const { accessible, hasSubmission, challengeSolved, completed } = input;
  if (completed) return "COMPLETED";
  if (!accessible) return "LOCKED";
  if (challengeSolved) return "CODE_PENDING";
  if (hasSubmission) return "IN_PROGRESS";
  return "AVAILABLE";
}
