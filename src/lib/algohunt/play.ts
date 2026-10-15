import { COPY } from "./copy";
import type { ParticipantState } from "./types";

/**
 * Client mirror of assertTeamCanPlay (server/algohunt/access.ts), so screens can disable an action
 * and say why before the server refuses it. The server stays the authority.
 */
export function playBlockReason(
  state: {
    event: Pick<ParticipantState["event"], "status" | "submissionsEnabled" | "codesEnabled">;
    team: Pick<ParticipantState["team"], "status">;
  },
  action: "submit" | "run" | "code",
  timeUp: boolean,
): string | null {
  const { event, team } = state;
  if (event.status === "ENDED" || event.status === "ARCHIVED") return COPY.errors.EVENT_ENDED;
  if (["DRAFT", "CHECK_IN", "READY"].includes(event.status)) return COPY.errors.EVENT_NOT_LIVE;
  if (timeUp) return COPY.timeUp;
  if (event.status === "PAUSED") return COPY.errors.EVENT_PAUSED;
  if (team.status === "DISQUALIFIED") return COPY.errors.TEAM_DISQUALIFIED;
  if (team.status === "REGISTERED") return COPY.errors.TEAM_NOT_CHECKED_IN;
  if (team.status === "FINISHED") return COPY.errors.TEAM_FINISHED;
  if ((action === "submit" || action === "run") && !event.submissionsEnabled) return COPY.errors.SUBMISSIONS_DISABLED;
  if (action === "code" && !event.codesEnabled) return COPY.errors.CODES_DISABLED;
  return null;
}
