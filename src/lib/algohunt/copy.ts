import type { ErrorCode } from "./types";

export const COPY = {
  start: "The hunt has begun. Solve Question 1. When it's accepted, find a QR on campus to unlock the next one.",
  accepted: "Question solved! The next question is locked. Find a QR hidden on campus, scan it, and enter its code to unlock it.",
  codeUnlocked: "Code accepted! Question {n} is now unlocked.",
  alreadyUnlocked: "Your team already unlocked Question {n} on another phone. Your code wasn't used.",
  alreadyUsed: "This code has already been used. Keep searching for another QR!",
  invalidCode: "That code isn't valid. Check it and try again.",
  notSolved: "Solve your current question first. Then you can use a code to unlock the next one.",
  cooldown: "Too many invalid codes. Please wait {s}s before trying again.",
  finished: "You've completed AlgoHunt 2.0! Your finish has been recorded. Please report to the organizers for final verification.",
  locked: "This question is locked. Solve your current question and enter a QR code to unlock the next one.",
  noGoingBack: "You've moved past this question. Questions can't be reopened.",
  paused: "The event is paused. Your progress is safe; please wait for the organizers.",
  notStarted: "AlgoHunt 2.0 hasn't started yet. Stay close to the Seminar Hall.",
  notCheckedIn: "Your team isn't checked in yet. Visit the check-in desk with your team.",
  ended: "AlgoHunt 2.0 has ended. Submissions are closed.",
  disqualified: "Your team has been disqualified. Contact the organizers.",
  errors: {
    UNAUTHENTICATED: "Please log in with your team code and password.",
    FORBIDDEN: "You do not have permission to do that.",
    NOT_FOUND: "The requested item could not be found.",
    VALIDATION: "Please check the information you entered and try again.",
    CONFLICT: "That change cannot be made in the current state.",
    RATE_LIMITED: "Too many requests. Please wait before trying again.",
    EVENT_NOT_LIVE: "AlgoHunt 2.0 hasn't started yet.",
    EVENT_PAUSED: "The event is paused. Your progress is safe; please wait for the organizers.",
    EVENT_ENDED: "AlgoHunt 2.0 has ended. Submissions are closed.",
    TEAM_NOT_CHECKED_IN: "Your team isn't checked in yet. Visit the check-in desk with your team.",
    TEAM_DISQUALIFIED: "Your team has been disqualified. Contact the organizers.",
    TEAM_FINISHED: "Your team has already finished AlgoHunt 2.0.",
    STAGE_LOCKED: "This question is locked. Solve your current question and enter a QR code to unlock the next one.",
    STAGE_DISABLED: "This question is temporarily unavailable. Please contact the organizers.",
    ALREADY_SOLVED: "Your team has already solved this question.",
    CHALLENGE_NOT_SOLVED: "Solve your current question first. Then you can use a code to unlock the next one.",
    SUBMISSIONS_DISABLED: "Submissions are temporarily unavailable. Please wait for the organizers.",
    CODES_DISABLED: "Code entry is temporarily unavailable. Please wait for the organizers.",
    COOLDOWN: "Too many invalid codes. Please wait before trying again.",
    UNSUPPORTED_LANGUAGE: "This language is not available for this question.",
    PAYLOAD_TOO_LARGE: "Your request is too large. Please shorten it and try again.",
    JUDGE_UNAVAILABLE: "The judge is busy or unreachable. Your progress has not been changed. Please submit again in a moment.",
    INTERNAL: "We could not process that request. Your progress has not been changed. Please try again or contact a volunteer.",
  } satisfies Record<ErrorCode, string>,
} as const;

export function codeUnlockedMessage(n: number): string {
  return COPY.codeUnlocked.replace("{n}", String(n));
}

export function alreadyUnlockedMessage(n: number): string {
  return COPY.alreadyUnlocked.replace("{n}", String(n));
}

export function cooldownMessage(s: number): string {
  return COPY.cooldown.replace("{s}", String(s));
}
