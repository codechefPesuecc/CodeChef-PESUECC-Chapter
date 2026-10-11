import type { EventStatus } from "@/lib/algohunt/types";

export interface NavEvent {
  id: string;
  slug: string;
  name: string;
  status: EventStatus;
  isTest: boolean;
}

export interface NavLinkDef {
  href: string;
  label: string;
}

const BASE = "/admin/algohunt";

/** Every link ships on day one. Pages owned by other modules 404 until their owner merges. */
export const NAV_LINKS: readonly NavLinkDef[] = [
  { href: BASE, label: "Overview" },
  { href: `${BASE}/teams`, label: "Teams" },
  { href: `${BASE}/control`, label: "Control" },
  { href: `${BASE}/codes`, label: "Codes" },
  { href: `${BASE}/submissions`, label: "Submissions" },
  { href: `${BASE}/audit`, label: "Audit" },
  { href: `${BASE}/announcements`, label: "Announcements" },
  { href: `${BASE}/volunteers`, label: "Volunteers" },
  { href: `${BASE}/events`, label: "Events" },
  { href: `${BASE}/import`, label: "Import" },
  { href: `${BASE}/content`, label: "Content" },
  { href: `${BASE}/exports`, label: "Exports" },
];

/** Same rule as resolveAdminEvent(null). `events` must be newest first. */
export function pickDefaultEvent(events: readonly NavEvent[]): NavEvent | null {
  return events.find((e) => !e.isTest && e.status !== "ARCHIVED") ?? events[0] ?? null;
}

export function resolveSelectedEvent(events: readonly NavEvent[], slugParam: string | null): NavEvent | null {
  if (slugParam) {
    const match = events.find((e) => e.slug === slugParam);
    if (match) return match;
  }
  return pickDefaultEvent(events);
}

export function withEvent(href: string, slug: string | null): string {
  return slug ? `${href}?event=${encodeURIComponent(slug)}` : href;
}

export function isLinkActive(pathname: string, href: string): boolean {
  if (href === BASE) return pathname === BASE;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A team page belongs to one event, so switching events from it lands on the overview instead. */
export function switchEventHref(pathname: string, slug: string): string {
  const onTeamDetail = new RegExp(`^${BASE}/teams/[^/]+/?$`).test(pathname);
  return withEvent(onTeamDetail ? BASE : pathname, slug);
}

export type StatusTone = "live" | "paused" | "idle";

export function statusTone(status: EventStatus): StatusTone {
  if (status === "LIVE") return "live";
  if (status === "PAUSED") return "paused";
  return "idle";
}

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  live: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300",
  idle: "border-hairline bg-hairline/40 text-charcoal/70",
};
