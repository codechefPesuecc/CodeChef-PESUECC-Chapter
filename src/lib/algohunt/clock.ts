// Countdown rules shared by the server play gate and the header clock, so both agree to the second.

export type CountdownLevel = "normal" | "warning" | "critical" | "over";

export const COUNTDOWN_WARNING_MS = 30 * 60_000;
export const COUNTDOWN_CRITICAL_MS = 10 * 60_000;

/** True from the scheduled end onwards. No scheduled end means play never stops on its own. */
export function isTimeUp(endsAt: number | null, now: number): boolean {
  return endsAt !== null && now >= endsAt;
}

export function countdownLevel(msLeft: number): CountdownLevel {
  if (msLeft <= 0) return "over";
  if (msLeft <= COUNTDOWN_CRITICAL_MS) return "critical";
  if (msLeft <= COUNTDOWN_WARNING_MS) return "warning";
  return "normal";
}

/** "02:07:45". Never negative; rounds up so the clock shows 00:00:00 only once time is really up. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
