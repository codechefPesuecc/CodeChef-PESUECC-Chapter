import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AnnouncementPriority, AnnouncementView } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAnnouncements, users } from "@/server/db/schema";
import { auditInsert, writeAudit } from "./audit";

export const ANNOUNCEMENT_MAX_CHARS = 500;

/**
 * Announcements are plain text: normalise line endings, drop control characters (newlines are
 * kept so a message can have more than one line), then trim. Never rendered as HTML.
 */
export function cleanAnnouncementMessage(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .trim();
}

/** Active announcements for an event, newest first. One query. */
export async function listActiveAnnouncements(eventId: string, limit = 5): Promise<AnnouncementView[]> {
  const rows = await getDb().select({
    id: ahAnnouncements.id,
    message: ahAnnouncements.message,
    priority: ahAnnouncements.priority,
    createdAt: ahAnnouncements.createdAt,
  }).from(ahAnnouncements)
    .where(and(eq(ahAnnouncements.eventId, eventId), eq(ahAnnouncements.active, true)))
    .orderBy(desc(ahAnnouncements.createdAt), desc(ahAnnouncements.id))
    .limit(limit);
  return rows.map((row) => ({ ...row, priority: row.priority as AnnouncementPriority }));
}

/** Every announcement for an event (admin view), newest first. */
export async function listAllAnnouncements(
  eventId: string,
): Promise<(AnnouncementView & { active: boolean; createdBy: string })[]> {
  const rows = await getDb().select({
    id: ahAnnouncements.id,
    message: ahAnnouncements.message,
    priority: ahAnnouncements.priority,
    createdAt: ahAnnouncements.createdAt,
    active: ahAnnouncements.active,
    createdBy: ahAnnouncements.createdBy,
  }).from(ahAnnouncements)
    .where(eq(ahAnnouncements.eventId, eventId))
    .orderBy(desc(ahAnnouncements.createdAt), desc(ahAnnouncements.id));
  return rows.map((row) => ({ ...row, priority: row.priority as AnnouncementPriority }));
}

/** Usernames for the admins who wrote announcements (admin list "author" column). */
export async function getAnnouncementAuthors(adminIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(adminIds)];
  if (ids.length === 0) return {};
  const rows = await getDb().select({ id: users.id, username: users.username })
    .from(users).where(inArray(users.id, ids));
  return Object.fromEntries(rows.map((row) => [row.id, row.username]));
}

/** Insert the announcement and its audit row together. `message` must already be cleaned and 1–500 chars. */
export async function createAnnouncement(p: {
  eventId: string;
  message: string;
  priority: AnnouncementPriority;
  adminId: string;
}): Promise<AnnouncementView> {
  const message = cleanAnnouncementMessage(p.message);
  if (message.length < 1 || message.length > ANNOUNCEMENT_MAX_CHARS) {
    throw new Error("Announcement message must be 1-500 characters of plain text.");
  }
  const db = getDb();
  const view: AnnouncementView = {
    id: crypto.randomUUID(), message, priority: p.priority, createdAt: Date.now(),
  };
  await db.batch([
    db.insert(ahAnnouncements).values({
      ...view, eventId: p.eventId, active: true, createdBy: p.adminId,
    }),
    auditInsert(db, {
      eventId: p.eventId, actorType: "ADMIN", actorId: p.adminId, action: "announcement.created",
      targetType: "announcement", targetId: view.id,
      metadata: { priority: p.priority, preview: message.slice(0, 80) },
    }),
  ]);
  return view;
}

/** Deactivate once; a repeat (or an unknown id) changes nothing and writes no audit row. */
export async function deactivateAnnouncement(p: { id: string; adminId: string }): Promise<{ changed: boolean }> {
  const [row] = await getDb().update(ahAnnouncements).set({ active: false })
    .where(and(eq(ahAnnouncements.id, p.id), eq(ahAnnouncements.active, true)))
    .returning({ eventId: ahAnnouncements.eventId });
  if (!row) return { changed: false };
  await writeAudit({
    eventId: row.eventId, actorType: "ADMIN", actorId: p.adminId, action: "announcement.deactivated",
    targetType: "announcement", targetId: p.id, metadata: {},
  });
  return { changed: true };
}
