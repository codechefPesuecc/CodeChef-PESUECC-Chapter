import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { ErrorCode } from "@/lib/algohunt/types";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import {
  ahEvents,
  ahVolunteers,
  users,
  type AhEvent,
  type AhVolunteer,
} from "@/server/db/schema";
import { resolveAdminEvent } from "./events";
import { auditInsert } from "./audit";

export interface VolunteerContext {
  user: SessionUser;
  event: AhEvent;
  isAdmin: boolean;
  volunteer: AhVolunteer | null;
}

const STATUS_PRIORITY: Record<string, number> = {
  LIVE: 5,
  PAUSED: 4,
  READY: 3,
  CHECK_IN: 2,
  DRAFT: 1,
};

/**
 * Signed-in site user with an active ah_volunteers row for the "operational" event,
 * or an admin. Otherwise null.
 */
export async function getVolunteerContext(opts?: {
  eventSlug?: string;
}): Promise<VolunteerContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const db = getDb();

  // If a specific eventSlug is requested
  if (opts?.eventSlug) {
    const slug = opts.eventSlug.trim();
    const [event] = await db
      .select()
      .from(ahEvents)
      .where(eq(ahEvents.slug, slug))
      .limit(1);

    if (!event || event.status === "ENDED" || event.status === "ARCHIVED") {
      return null;
    }

    const [volRow] = await db
      .select()
      .from(ahVolunteers)
      .where(
        and(
          eq(ahVolunteers.eventId, event.id),
          eq(ahVolunteers.userId, user.id),
          eq(ahVolunteers.active, true)
        )
      )
      .limit(1);

    if (volRow) {
      return { user, event, isAdmin: user.isAdmin, volunteer: volRow };
    }

    if (user.isAdmin) {
      return { user, event, isAdmin: true, volunteer: null };
    }

    return null;
  }

  // Look for active volunteer rows for this user
  const volRows = await db
    .select()
    .from(ahVolunteers)
    .where(and(eq(ahVolunteers.userId, user.id), eq(ahVolunteers.active, true)));

  let chosenEvent: AhEvent | null = null;
  let chosenVolunteer: AhVolunteer | null = null;

  if (volRows.length > 0) {
    const eventIds = volRows.map((r) => r.eventId);
    const candidateEvents = await db
      .select()
      .from(ahEvents)
      .where(inArray(ahEvents.id, eventIds));

    const validCandidates = candidateEvents.filter(
      (e) => e.status !== "ENDED" && e.status !== "ARCHIVED"
    );

    if (validCandidates.length > 0) {
      // Prefer LIVE, then PAUSED, then READY, then CHECK_IN, then DRAFT.
      // Prefer non-test events (isTest: 0/false).
      validCandidates.sort((a, b) => {
        const scoreA = (STATUS_PRIORITY[a.status] ?? 0) + (a.isTest ? 0 : 10);
        const scoreB = (STATUS_PRIORITY[b.status] ?? 0) + (b.isTest ? 0 : 10);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.createdAt - a.createdAt;
      });

      chosenEvent = validCandidates[0];
      chosenVolunteer = volRows.find((r) => r.eventId === chosenEvent!.id) ?? null;
    }
  }

  if (chosenEvent && chosenVolunteer) {
    return {
      user,
      event: chosenEvent,
      isAdmin: user.isAdmin,
      volunteer: chosenVolunteer,
    };
  }

  // If user is an admin without an active volunteer row
  if (user.isAdmin) {
    const adminEvent = await resolveAdminEvent(opts?.eventSlug ?? null);
    if (adminEvent && adminEvent.status !== "ENDED" && adminEvent.status !== "ARCHIVED") {
      return {
        user,
        event: adminEvent,
        isAdmin: true,
        volunteer: null,
      };
    }
  }

  return null;
}

export async function listVolunteers(eventId: string): Promise<
  {
    id: string;
    userId: string;
    username: string;
    name: string | null;
    active: boolean;
  }[]
> {
  const db = getDb();
  const rows = await db
    .select({
      id: ahVolunteers.id,
      userId: ahVolunteers.userId,
      username: users.username,
      name: users.name,
      active: ahVolunteers.active,
    })
    .from(ahVolunteers)
    .innerJoin(users, eq(ahVolunteers.userId, users.id))
    .where(eq(ahVolunteers.eventId, eventId))
    .orderBy(desc(ahVolunteers.createdAt));

  return rows;
}

export async function assignVolunteer(p: {
  eventId: string;
  username: string;
  adminId: string;
}): Promise<{ ok: true; id: string } | { ok: false; code: ErrorCode; message: string }> {
  const db = getDb();
  const username = p.username.trim().toLowerCase();

  const [targetUser] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!targetUser) {
    return { ok: false, code: "NOT_FOUND", message: "User not found." };
  }

  const [existing] = await db
    .select()
    .from(ahVolunteers)
    .where(and(eq(ahVolunteers.eventId, p.eventId), eq(ahVolunteers.userId, targetUser.id)))
    .limit(1);

  const now = Date.now();
  let volId: string;

  if (existing) {
    volId = existing.id;
    await db.batch([
      db
        .update(ahVolunteers)
        .set({ active: true, createdAt: now })
        .where(eq(ahVolunteers.id, existing.id)),
      auditInsert(db, {
        eventId: p.eventId,
        teamId: null,
        actorType: "ADMIN",
        actorId: p.adminId,
        action: "volunteer.assigned",
        targetType: "volunteer",
        targetId: volId,
        metadata: { username: targetUser.username, userId: targetUser.id },
      }),
    ]);
  } else {
    volId = crypto.randomUUID();
    await db.batch([
      db.insert(ahVolunteers).values({
        id: volId,
        eventId: p.eventId,
        userId: targetUser.id,
        active: true,
        createdAt: now,
      }),
      auditInsert(db, {
        eventId: p.eventId,
        teamId: null,
        actorType: "ADMIN",
        actorId: p.adminId,
        action: "volunteer.assigned",
        targetType: "volunteer",
        targetId: volId,
        metadata: { username: targetUser.username, userId: targetUser.id },
      }),
    ]);
  }

  return { ok: true, id: volId };
}

export async function removeVolunteer(p: {
  id: string;
  adminId: string;
}): Promise<{ ok: boolean }> {
  const db = getDb();
  const [vol] = await db
    .select({ id: ahVolunteers.id, eventId: ahVolunteers.eventId, userId: ahVolunteers.userId })
    .from(ahVolunteers)
    .where(eq(ahVolunteers.id, p.id))
    .limit(1);

  if (!vol) {
    return { ok: false };
  }

  await db.batch([
    db
      .update(ahVolunteers)
      .set({ active: false })
      .where(eq(ahVolunteers.id, p.id)),
    auditInsert(db, {
      eventId: vol.eventId,
      teamId: null,
      actorType: "ADMIN",
      actorId: p.adminId,
      action: "volunteer.removed",
      targetType: "volunteer",
      targetId: p.id,
      metadata: { id: p.id, userId: vol.userId },
    }),
  ]);

  return { ok: true };
}
