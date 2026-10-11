import { EVENT_TRANSITIONS, type EventStatus } from "@/lib/algohunt/types";

export interface ControlStage {
  id: string;
  stageNumber: number;
  title: string;
  isFinal: boolean;
  enabled: boolean;
  verified: boolean;
}

export interface Readiness {
  stages: number;
  challengesUnverified: number;
  finalStageOk: boolean;
  activeCodes: number;
  checkedInTeams: number;
}

/** The numbers behind the "ready to start" strip. */
export function deriveReadiness(
  stages: { stageNumber: number; isFinal: boolean; verified: boolean }[],
  activeCodes: number,
  checkedInTeams: number,
): Readiness {
  const finals = stages.filter((s) => s.isFinal);
  const highest = stages.reduce((max, s) => Math.max(max, s.stageNumber), 0);
  return {
    stages: stages.length,
    challengesUnverified: stages.filter((s) => !s.verified).length,
    finalStageOk: finals.length === 1 && finals[0].stageNumber === highest,
    activeCodes,
    checkedInTeams,
  };
}

/** What is wrong, in plain words. Empty means ready. Starting is still allowed either way. */
export function readinessIssues(r: Readiness): string[] {
  const issues: string[] = [];
  if (r.stages === 0) {
    issues.push("No questions are set up yet.");
  } else {
    if (r.challengesUnverified > 0) {
      issues.push(`${r.challengesUnverified} ${r.challengesUnverified === 1 ? "question is" : "questions are"} not verified on the judge.`);
    }
    if (!r.finalStageOk) {
      issues.push("The final question isn't set up correctly: there must be exactly one, and it must be the highest number.");
    }
  }
  if (r.activeCodes === 0) issues.push("There are 0 active codes.");
  if (r.checkedInTeams === 0) issues.push("No team is checked in.");
  return issues;
}

export interface TransitionOption {
  to: EventStatus;
  label: string;
  consequences: string;
  /** Big button for the moves organizers use during the event; small for setup and wrap-up. */
  primary: boolean;
  danger: boolean;
}

const END_COPY = "Final. No more submissions or codes. Finish times freeze.";
const READY_COPY = "Marks the event ready to start. Nothing opens for teams yet.";

type MoveCopy = Omit<TransitionOption, "to">;

/** Keyed "FROM>TO". Anything the engine allows but is missing here gets a generic button. */
const MOVES: Record<string, MoveCopy> = {
  "READY>LIVE": {
    label: "START EVENT", primary: true, danger: false,
    consequences: "Every checked-in team can open Question 1 immediately. The start time is recorded.",
  },
  "LIVE>PAUSED": {
    label: "PAUSE", primary: true, danger: false,
    consequences: "All submissions and code redemptions stop immediately. Teams see a paused banner.",
  },
  "PAUSED>LIVE": {
    label: "RESUME", primary: true, danger: false,
    consequences: "Submissions and code redemptions work again immediately.",
  },
  "LIVE>ENDED": { label: "END EVENT", primary: true, danger: true, consequences: END_COPY },
  "PAUSED>ENDED": { label: "END EVENT", primary: true, danger: true, consequences: END_COPY },
  "DRAFT>CHECK_IN": {
    label: "Open check-in", primary: false, danger: false,
    consequences: "Teams can be checked in at the desk. Play stays closed.",
  },
  "DRAFT>READY": { label: "Mark ready", primary: false, danger: false, consequences: READY_COPY },
  "CHECK_IN>READY": { label: "Mark ready", primary: false, danger: false, consequences: READY_COPY },
  "CHECK_IN>DRAFT": {
    label: "Back to draft", primary: false, danger: false, consequences: "Moves the event back to draft.",
  },
  "READY>CHECK_IN": {
    label: "Back to check-in", primary: false, danger: false, consequences: "Moves the event back to check-in.",
  },
  "ENDED>ARCHIVED": {
    label: "Archive", primary: false, danger: true,
    consequences: "Archives the event. Teams can no longer log in to it, and this can't be undone.",
  },
};

/** Only the moves the engine allows from this status, in a stable order (big buttons first). */
export function transitionOptions(status: EventStatus): TransitionOption[] {
  const options = EVENT_TRANSITIONS[status].map((to): TransitionOption => {
    const copy = MOVES[`${status}>${to}`];
    if (copy) return { to, ...copy };
    return { to, label: `Move to ${to}`, consequences: `Moves the event to ${to}.`, primary: false, danger: false };
  });
  return options.sort((a, b) => Number(b.primary) - Number(a.primary));
}

export type FlagKey = "submissionsEnabled" | "codesEnabled" | "leaderboardVisible";

export interface FlagRow {
  key: FlagKey;
  label: string;
  explanation: string;
  turnOff: { title: string; consequences: string };
  turnOn: { title: string; consequences: string };
}

export const FLAG_ROWS: readonly FlagRow[] = [
  {
    key: "submissionsEnabled",
    label: "Submissions",
    explanation: "Teams can run and submit code. Turn it off if the judge is down.",
    turnOff: {
      title: "Turn submissions off?",
      consequences: "Every new run and submission is rejected immediately. Progress already made is kept.",
    },
    turnOn: { title: "Turn submissions on?", consequences: "Teams can run and submit code again immediately." },
  },
  {
    key: "codesEnabled",
    label: "Code redemption",
    explanation: "Teams can enter QR codes. Turn it off if a whole batch leaks.",
    turnOff: {
      title: "Turn code redemption off?",
      consequences: "Teams can't unlock the next question with a code until you turn it back on. Use Unlock without a code to help a team.",
    },
    turnOn: { title: "Turn code redemption on?", consequences: "Teams can enter codes again immediately." },
  },
  {
    key: "leaderboardVisible",
    label: "Leaderboard visible to teams",
    explanation: "Teams see the leaderboard. Turn it off to hide the standings.",
    turnOff: {
      title: "Hide the leaderboard?",
      consequences: "Teams see an empty leaderboard until you show it again. Admins still see the standings.",
    },
    turnOn: { title: "Show the leaderboard?", consequences: "Teams can see the standings again." },
  },
];
