import crypto from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { EVENT_TRANSITIONS, type ErrorCode, type EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents, type AhEvent } from "@/server/db/schema";
import { auditInsert } from "./audit";

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

export async function listEvents(): Promise<AhEvent[]> {
  return getDb().select().from(ahEvents).orderBy(desc(ahEvents.createdAt));
}

export function getTeamCodePrefix(event: { slug: string; isTest?: boolean }): "AH2" | "TST" | "DRY" {
  if (event.slug.startsWith("dry")) return "DRY";
  if (event.slug.startsWith("test") || event.isTest) return "TST";
  return "AH2";
}

export async function createEvent(p: {
  name: string;
  slug: string;
  isTest?: boolean;
  maxTeamSize?: number;
  rankingMode?: "SOLVED_THEN_TIME";
  leaderboardVisible?: boolean;
  submissionsEnabled?: boolean;
  codesEnabled?: boolean;
  actorId?: string;
}): Promise<{ ok: true; event: AhEvent } | { ok: false; code: ErrorCode; message: string }> {
  const db = getDb();
  const slug = p.slug.trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, code: "VALIDATION", message: "Slug must contain only lowercase letters, numbers, and hyphens." };
  }
  const name = p.name.trim();
  if (!name) {
    return { ok: false, code: "VALIDATION", message: "Event name is required." };
  }

  const existing = await getEventBySlug(slug);
  if (existing) {
    return { ok: false, code: "CONFLICT", message: `Event with slug "${slug}" already exists.` };
  }

  const now = Date.now();
  const eventId = crypto.randomUUID();
  const isTest = Boolean(p.isTest ?? (slug.startsWith("test") || slug.startsWith("dry")));

  const [event] = await db.insert(ahEvents).values({
    id: eventId,
    slug,
    name,
    isTest,
    status: "DRAFT",
    maxTeamSize: p.maxTeamSize ?? 4,
    rankingMode: p.rankingMode ?? "SOLVED_THEN_TIME",
    leaderboardVisible: p.leaderboardVisible ?? true,
    submissionsEnabled: p.submissionsEnabled ?? true,
    codesEnabled: p.codesEnabled ?? true,
    startedAt: null,
    pausedAt: null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  if (p.actorId) {
    await db.insert(ahAuditLogs).values({
      id: crypto.randomUUID(),
      eventId,
      teamId: null,
      actorType: "ADMIN",
      actorId: p.actorId,
      action: "event.created",
      targetType: "event",
      targetId: eventId,
      metadata: JSON.stringify({ slug, name, isTest }),
      ip: null,
      userAgent: null,
      createdAt: now,
    });
  }

  return { ok: true, event };
}

/**
 * Set or clear the scheduled end. From that moment assertTeamCanPlay refuses submit, run and code
 * entry; the status stays LIVE so the end can still be moved. One audit row per real change.
 */
export async function setEventEndTime(p: {
  eventId: string;
  actorId: string;
  reason: string;
  endsAt: number | null;
  ip?: string;
  userAgent?: string;
}): Promise<{ ok: true; event: AhEvent; changed: boolean } | { ok: false; code: ErrorCode; message: string }> {
  const event = await getEventById(p.eventId);
  if (!event) return { ok: false, code: "NOT_FOUND", message: "Event not found." };
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return { ok: false, code: "CONFLICT", message: "The event has already ended." };
  }
  if (event.endsAt === p.endsAt) return { ok: true, event, changed: false };
  const db = getDb();
  await db.batch([
    db.update(ahEvents).set({ endsAt: p.endsAt, updatedAt: Date.now() }).where(eq(ahEvents.id, p.eventId)),
    auditInsert(db, {
      eventId: p.eventId,
      actorType: "ADMIN",
      actorId: p.actorId,
      action: "event.end_time_changed",
      targetType: "event",
      targetId: p.eventId,
      metadata: { from: event.endsAt, to: p.endsAt, reason: p.reason },
      ip: p.ip,
      userAgent: p.userAgent,
    }),
  ]);
  const fresh = await getEventById(p.eventId);
  if (!fresh) throw new Error("Updated event disappeared");
  return { ok: true, event: fresh, changed: true };
}
