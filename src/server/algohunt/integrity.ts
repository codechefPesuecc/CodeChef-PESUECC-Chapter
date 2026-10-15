import crypto from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { isTimeUp } from "@/lib/algohunt/clock";
import { AWAY_REASONS, type AwayReason } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahIntegrityEvents } from "@/server/db/schema";
import type { TeamContext } from "./teamSession";

// Time a laptop spends away from the AlgoHunt page while playing. Track and alert only: admins
// review it, nothing here disqualifies a team. These are client signals, so a modified browser can
// stay silent; their value is the record they leave for honest-but-tempted teams.

/** Away time only counts while the team can actually play: LIVE, checked in, before the end. */
export function isWatching(ctx: TeamContext, now = Date.now()): boolean {
  return ctx.event.status === "LIVE" && ctx.team.status === "CHECKED_IN" && !isTimeUp(ctx.event.endsAt, now);
}

export async function startAwayEpisode(p: {
  ctx: TeamContext;
  deviceId: string;
  reasons: readonly AwayReason[];
  now?: number;
}): Promise<{ recorded: false } | { recorded: true; id: string; teamCount: number }> {
  const now = p.now ?? Date.now();
  if (!isWatching(p.ctx, now)) return { recorded: false };
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(ahIntegrityEvents).values({
    id,
    eventId: p.ctx.event.id,
    teamId: p.ctx.team.id,
    deviceId: p.deviceId,
    reasons: AWAY_REASONS.filter((reason) => p.reasons.includes(reason)).join(","),
    leftAt: now,
  });
  const [{ total }] = await db.select({ total: count() }).from(ahIntegrityEvents)
    .where(eq(ahIntegrityEvents.teamId, p.ctx.team.id));
  return { recorded: true, id, teamCount: total };
}

/**
 * Stamps the return. Only the device that left can close its own episode, and only once. Returns the
 * recorded time away, so the team is told exactly what organizers see.
 */
export async function endAwayEpisode(p: {
  ctx: TeamContext;
  deviceId: string;
  id: string;
  now?: number;
}): Promise<{ closed: boolean; awayMs: number | null }> {
  const now = p.now ?? Date.now();
  const [closed] = await getDb().update(ahIntegrityEvents)
    .set({ returnedAt: now })
    .where(and(
      eq(ahIntegrityEvents.id, p.id),
      eq(ahIntegrityEvents.teamId, p.ctx.team.id),
      eq(ahIntegrityEvents.deviceId, p.deviceId),
      isNull(ahIntegrityEvents.returnedAt),
    ))
    .returning({ leftAt: ahIntegrityEvents.leftAt });
  return closed ? { closed: true, awayMs: now - closed.leftAt } : { closed: false, awayMs: null };
}
