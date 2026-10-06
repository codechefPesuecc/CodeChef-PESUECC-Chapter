import crypto from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { EVENT_TRANSITIONS, type ErrorCode, type EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents, type AhEvent } from "@/server/db/schema";

export async function getEventById(id: string): Promise<AhEvent | null> {
  const [event] = await getDb().select().from(ahEvents).where(eq(ahEvents.id, id)).limit(1);
  return event ?? null;
}

export async function getEventBySlug(slug: string): Promise<AhEvent | null> {
  const [event] = await getDb().select().from(ahEvents).where(eq(ahEvents.slug, slug)).limit(1);
  return event ?? null;
}

export async function resolveAdminEvent(slug?: string | null): Promise<AhEvent | null> {
  if (slug) return getEventBySlug(slug);
  const db = getDb();
  const [preferred] = await db.select().from(ahEvents)
    .where(and(eq(ahEvents.isTest, false), ne(ahEvents.status, "ARCHIVED")))
    .orderBy(desc(ahEvents.createdAt)).limit(1);
  if (preferred) return preferred;
  const [newest] = await db.select().from(ahEvents).orderBy(desc(ahEvents.createdAt)).limit(1);
  return newest ?? null;
}

export async function transitionEvent(p: {
  eventId: string;
  to: EventStatus;
  actorId: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ ok: true; event: AhEvent } | { ok: false; code: ErrorCode; message: string }> {
  const db = getDb();
  const event = await getEventById(p.eventId);
  if (!event) return { ok: false, code: "NOT_FOUND", message: "Event not found." };
  const from = event.status as EventStatus;
  if (!EVENT_TRANSITIONS[from]?.includes(p.to)) {
    return { ok: false, code: "CONFLICT", message: `Can't move from ${from} to ${p.to}.` };
  }
  const now = Date.now();
  const patch: Partial<AhEvent> = { status: p.to, updatedAt: now };
  if (p.to === "LIVE") {
    patch.startedAt = event.startedAt ?? now;
    patch.pausedAt = null;
  } else if (p.to === "PAUSED") {
    patch.pausedAt = now;
  } else if (p.to === "ENDED") {
    patch.endedAt = now;
    patch.pausedAt = null;
  }
  const metadata = JSON.stringify({ from, to: p.to });
  const auditId = crypto.randomUUID();
  const [changed] = await db.batch([
    db.update(ahEvents).set(patch)
      .where(and(eq(ahEvents.id, p.eventId), eq(ahEvents.status, from)))
      .returning({ id: ahEvents.id }),
    db.insert(ahAuditLogs).select(sql`
      SELECT ${auditId}, ${p.eventId}, NULL, 'ADMIN', ${p.actorId}, 'event.transition',
        'event', ${p.eventId}, ${metadata}, ${p.ip ?? null}, ${p.userAgent?.slice(0, 300) ?? null}, ${now}
      WHERE EXISTS (
        SELECT 1 FROM ah_events WHERE id = ${p.eventId} AND status = ${p.to} AND updated_at = ${now}
      )
    `),
  ]);
  if (changed.length === 0) {
    return { ok: false, code: "CONFLICT", message: "The event changed meanwhile. Refresh and try again." };
  }
  const fresh = await getEventById(p.eventId);
  if (!fresh) throw new Error("Updated event disappeared");
  return { ok: true, event: fresh };
}

export async function updateEventFlags(p: {
  eventId: string;
  actorId: string;
  reason: string;
  flags: Partial<Pick<AhEvent, "submissionsEnabled" | "codesEnabled" | "leaderboardVisible">>;
}): Promise<AhEvent> {
  const db = getDb();
  const now = Date.now();
  const changes = Object.fromEntries(Object.entries(p.flags).filter(([, value]) => value !== undefined));
  await db.batch([
    db.update(ahEvents).set({ ...changes, updatedAt: now }).where(eq(ahEvents.id, p.eventId)),
    db.insert(ahAuditLogs).select(sql`
      SELECT ${crypto.randomUUID()}, ${p.eventId}, NULL, 'ADMIN', ${p.actorId}, 'event.flags_changed',
        'event', ${p.eventId}, ${JSON.stringify({ changes, reason: p.reason })}, NULL, NULL, ${now}
      WHERE EXISTS (SELECT 1 FROM ah_events WHERE id = ${p.eventId})
    `),
  ]);
  const fresh = await getEventById(p.eventId);
  if (!fresh) throw new Error("Event not found");
  return fresh;
}
