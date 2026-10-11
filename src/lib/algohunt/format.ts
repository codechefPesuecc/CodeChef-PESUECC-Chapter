/**
 * IST formatting helpers for AlgoHunt 2.0.
 * IST = UTC+5:30, no DST, fixed offset.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Format an epoch-ms timestamp as a human-readable IST datetime.
 * e.g. "23 Oct 2026, 10:35 AM"
 */
export function formatIST(epochMs: number): string {
  const ist = new Date(epochMs + IST_OFFSET_MS);
  const day = ist.getUTCDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  let hours = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * e.g. "1h 23m 45s", "45m 12s", "12s"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}
