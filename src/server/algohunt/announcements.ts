import { and, desc, eq } from "drizzle-orm";
import type { AnnouncementPriority, AnnouncementView } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahAnnouncements } from "@/server/db/schema";

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
