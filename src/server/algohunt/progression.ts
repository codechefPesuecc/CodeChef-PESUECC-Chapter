/**
 * AlgoHunt progression engine — local mock until Module 1 lands.
 * Module 1 owns the real implementation; this stub is deleted when M1 merges.
 *
 * Real implementation: src/server/algohunt/progression.ts (M1)
 */
import type { TeamContext } from "./teamSession";

/**
 * Record that a team has solved a challenge (via AC verdict).
 * For the final question, this also completes the question and finishes the team.
 * TODO(M1): Replace with real atomic DB implementation.
 */
export async function recordChallengeSolved(_p: {
  ctx: TeamContext;
  stageId: string;
  submissionId: string;
}): Promise<{ alreadySolved: boolean; finished: boolean }> {
  // M1 stub: returns alreadySolved=false, finished=false until M1 lands.
  return { alreadySolved: false, finished: false };
}
