/**
 * Participant-facing copy and error messages for AlgoHunt 2.0.
 * The UI always says "Question N", never "stage".
 * Templated strings are exported as functions: codeUnlockedMessage(n),
 * alreadyUnlockedMessage(n), cooldownMessage(s).
 */
import type { ErrorCode } from "./types";

export const COPY = {
  start: "The hunt has begun. Solve Question 1. When it's accepted, find a QR on campus to unlock the next one.",
  accepted: "Question solved! The next question is locked. Find a QR hidden on campus, scan it, and enter its code to unlock it.",
  codeUnlocked: (n: number) => `Code accepted! Question ${n} is now unlocked.`,
  alreadyUnlocked: (n: number) => `Your team already unlocked Question ${n} on another phone. Your code wasn't used.`,
  alreadyUsed: "This code has already been used. Keep searching for another QR!",
  invalidCode: "That code isn't valid. Check it and try again.",
  notSolved: "Solve your current question first. Then you can use a code to unlock the next one.",
  cooldown: (s: number) => `Too many invalid codes. Please wait ${s}s before trying again.`,
  finished: "You've completed AlgoHunt 2.0! Your finish has been recorded. Please report to the organizers for final verification.",
  locked: "This question is locked. Solve your current question and enter a QR code to unlock the next one.",
  noGoingBack: "You've moved past this question. Questions can't be reopened.",
  paused: "The event is paused. Your progress is safe; please wait for the organizers.",
  notStarted: "AlgoHunt 2.0 hasn't started yet. Stay close to the Seminar Hall.",
  notCheckedIn: "Your team isn't checked in yet. Visit the check-in desk with your team.",
  ended: "AlgoHunt 2.0 has ended. Submissions are closed.",
  disqualified: "Your team has been disqualified. Contact the organizers.",
  errors: {
    INTERNAL: "We could not process that request. Your progress has not been changed. Please try again or contact a volunteer.",
    JUDGE_UNAVAILABLE: "The judge is busy or unreachable. Your progress has not been changed. Please submit again in a moment.",
    CHALLENGE_NOT_SOLVED: "Solve your current question first. Then you can use a code to unlock the next one.",
    UNAUTHENTICATED: "You are not logged in. Please log in to continue.",
    FORBIDDEN: "You do not have permission to perform this action.",
    NOT_FOUND: "The requested resource was not found.",
    VALIDATION: "The request was invalid. Please check your input.",
    CONFLICT: "There was a conflict with the current state. Please try again.",
    RATE_LIMITED: "Too many requests. Please wait before trying again.",
    EVENT_NOT_LIVE: "AlgoHunt 2.0 hasn't started yet. Stay close to the Seminar Hall.",
    EVENT_PAUSED: "The event is paused. Your progress is safe; please wait for the organizers.",
    EVENT_ENDED: "AlgoHunt 2.0 has ended. Submissions are closed.",
    TEAM_NOT_CHECKED_IN: "Your team isn't checked in yet. Visit the check-in desk with your team.",
    TEAM_DISQUALIFIED: "Your team has been disqualified. Contact the organizers.",
    TEAM_FINISHED: "Your team has already finished AlgoHunt 2.0.",
    STAGE_LOCKED: "This question is locked. Solve your current question and enter a QR code to unlock the next one.",
    STAGE_DISABLED: "This question is currently disabled. Please contact an organizer.",
    ALREADY_SOLVED: "You've already solved this question. Find a QR code on campus to unlock the next one.",
    CODES_DISABLED: "Code redemption is temporarily disabled. Please wait.",
    COOLDOWN: "Too many invalid codes. Please wait before trying again.",
    UNSUPPORTED_LANGUAGE: "This programming language is not supported for this question.",
    PAYLOAD_TOO_LARGE: "Your submission is too large. Please reduce the size.",
    SUBMISSIONS_DISABLED: "Submissions are temporarily disabled. Please wait.",
  } satisfies Record<ErrorCode, string>,
} as const;

export function codeUnlockedMessage(n: number): string {
  return COPY.codeUnlocked(n);
}

export function alreadyUnlockedMessage(n: number): string {
  return COPY.alreadyUnlocked(n);
}

export function cooldownMessage(s: number): string {
  return COPY.cooldown(s);
}
