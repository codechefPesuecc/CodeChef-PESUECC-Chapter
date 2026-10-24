import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { isTimeUp } from "@/lib/algohunt/clock";
import {
  compareLabels,
  deriveClueStatus,
  isClueLikeToken,
  MAX_CLUES,
  placementToken,
  validateClues,
  type ClueLine,
  type ClueProblem,
  type ClueStatus,
  type PublicClueBook,
} from "@/lib/algohunt/clues";
import { COPY } from "@/lib/algohunt/copy";
import type { CodeStatus, ErrorCode, EventStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahClues, ahCodes, ahEvents, type AhEvent } from "@/server/db/schema";
import { auditInsert } from "./audit";
import { getEventById, getEventBySlug } from "./events";

export { parseClueLines, placementToken, validateClues } from "@/lib/algohunt/clues";

interface LinkableCode {
  serial: number;
  status: string;
  usedAt: number | null;
  placementNote: string | null;
}

/** Codes of the event that carry a placement note (the only ones a clue can link to). */
async function codesWithNotes(eventId: string): Promise<LinkableCode[]> {
  return getDb()
    .select({ serial: ahCodes.serial, status: ahCodes.status, usedAt: ahCodes.usedAt, placementNote: ahCodes.placementNote })
    .from(ahCodes)
    .where(and(eq(ahCodes.eventId, eventId), isNotNull(ahCodes.placementNote)))
    .orderBy(asc(ahCodes.serial));
}

/**
 * Links each label to the codes whose placement note starts with it, case-insensitively. Codes whose
 * note starts with something clue-like that matches no label come back as orphans.
 */
function linkCodes(labels: readonly string[], codes: readonly LinkableCode[]) {
  const byLabel = new Map<string, LinkableCode[]>(labels.map((label) => [label.toLowerCase(), []]));
  const orphans: LinkableCode[] = [];
  for (const code of codes) {
    const token = placementToken(code.placementNote);
    if (!token) continue;
    const linked = byLabel.get(token.toLowerCase());
    if (linked) linked.push(code);
    else if (isClueLikeToken(token)) orphans.push(code);
  }
  return { byLabel, orphans };
}

/** The event a clue book link without ?event= shows: the running hunt, else the newest real event. */
export async function resolveClueBookEvent(slug?: string | null): Promise<AhEvent | null> {
  if (slug) return getEventBySlug(slug);
  const db = getDb();
  const [running] = await db.select().from(ahEvents)
    .where(and(eq(ahEvents.isTest, false), inArray(ahEvents.status, ["LIVE", "PAUSED"])))
    .orderBy(desc(ahEvents.startedAt)).limit(1);
  if (running) return running;
  const [newest] = await db.select().from(ahEvents)
    .where(eq(ahEvents.isTest, false))
    .orderBy(desc(ahEvents.createdAt)).limit(1);
  return newest ?? null;
}

/**
 * The public clue book. Hidden before the hunt starts; live while it runs; final statuses once time
 * is up or the event ended. Carries clue labels, riddles and statuses only.
 */
export async function getPublicClueBook(eventId: string): Promise<PublicClueBook | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  const now = Date.now();
  const status = event.status as EventStatus;
  const running = status === "LIVE" || status === "PAUSED";
  const final = status === "ENDED" || status === "ARCHIVED" || (running && isTimeUp(event.endsAt, now));
  const base = { serverNow: now, event: { name: event.name, status, endsAt: event.endsAt }, final };
  if (!running && !final) {
    return { ...base, visible: false, clues: [], openCount: 0, total: 0 };
  }

  const [clues, codes] = await Promise.all([
    getDb().select({ label: ahClues.label, text: ahClues.text }).from(ahClues).where(eq(ahClues.eventId, eventId)),
    codesWithNotes(eventId),
  ]);
  const { byLabel } = linkCodes(clues.map((c) => c.label), codes);
  const publicClues = clues
    .map((clue) => ({ label: clue.label, text: clue.text, ...deriveClueStatus(byLabel.get(clue.label.toLowerCase()) ?? []) }))
    .sort((a, b) => compareLabels(a.label, b.label));
  return {
    ...base,
    visible: true,
    clues: publicClues,
    openCount: publicClues.filter((c) => c.status === "OPEN").length,
    total: publicClues.length,
  };
}

export interface AdminClueCode {
  serial: number;
  status: CodeStatus;
  placementNote: string | null;
  usedAt: number | null;
}

export interface AdminClue {
  label: string;
  text: string;
  status: ClueStatus;
  foundAt: number | null;
  codes: AdminClueCode[];
}

export interface AdminClueBook {
  clues: AdminClue[];
  /** Labels no code points at: nobody can find these. */
  unlinkedClues: string[];
  /** Codes whose note starts with a clue-like label that isn't in the clue book. */
  codesWithoutClue: AdminClueCode[];
  savedAt: number | null;
}

function toAdminCode(code: LinkableCode): AdminClueCode {
  return { serial: code.serial, status: code.status as CodeStatus, placementNote: code.placementNote, usedAt: code.usedAt };
}

async function buildAdminClueBook(eventId: string, clues: readonly { label: string; text: string }[]) {
  const { byLabel, orphans } = linkCodes(clues.map((c) => c.label), await codesWithNotes(eventId));
  const adminClues = clues.map((clue) => {
    const linked = byLabel.get(clue.label.toLowerCase()) ?? [];
    return { label: clue.label, text: clue.text, ...deriveClueStatus(linked), codes: linked.map(toAdminCode) };
  });
  return {
    clues: adminClues,
    unlinkedClues: adminClues.filter((c) => c.codes.length === 0).map((c) => c.label),
    codesWithoutClue: orphans.map(toAdminCode),
  };
}

/** The saved clue book with the codes behind each clue, in the order it was pasted. */
export async function getAdminClueBook(eventId: string): Promise<AdminClueBook> {
  const rows = await getDb()
    .select({ label: ahClues.label, text: ahClues.text, updatedAt: ahClues.updatedAt })
    .from(ahClues)
    .where(eq(ahClues.eventId, eventId))
    .orderBy(asc(ahClues.position));
  const savedAt = rows.length > 0 ? Math.max(...rows.map((r) => r.updatedAt)) : null;
  return { ...(await buildAdminClueBook(eventId, rows)), savedAt };
}

/** What a pasted clue list would link to, without saving it (the admin's "Check clues"). */
export async function previewClueBook(eventId: string, entries: readonly ClueLine[]): Promise<AdminClueBook> {
  return { ...(await buildAdminClueBook(eventId, entries)), savedAt: null };
}

/**
 * Replaces the event's whole clue book (delete, inserts and the audit row in one D1 batch, so it is
 * all or nothing). Nothing is written unless every line passes validateClues.
 */
export async function replaceClues(p: {
  eventId: string;
  entries: readonly ClueLine[];
  adminId: string;
}): Promise<
  | { ok: true; count: number }
  | { ok: false; code: ErrorCode; message: string; problems?: ClueProblem[] }
> {
  if (p.entries.length < 1) return { ok: false, code: "VALIDATION", message: "Paste at least one clue." };
  if (p.entries.length > MAX_CLUES) {
    return { ok: false, code: "VALIDATION", message: `Save at most ${MAX_CLUES} clues.` };
  }
  const problems = validateClues(p.entries);
  if (problems.length > 0) {
    return { ok: false, code: "VALIDATION", message: "Some clues can't be saved. Fix them and try again.", problems };
  }

  const db = getDb();
  const event = await getEventById(p.eventId);
  if (!event) return { ok: false, code: "NOT_FOUND", message: COPY.errors.NOT_FOUND };
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return { ok: false, code: "EVENT_ENDED", message: COPY.errors.EVENT_ENDED };
  }

  const [previous] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ahClues)
    .where(eq(ahClues.eventId, p.eventId));
  const now = Date.now();
  const rows = p.entries.map((entry, idx) => ({
    id: crypto.randomUUID(),
    eventId: p.eventId,
    label: entry.label,
    text: entry.text,
    position: idx + 1,
    createdAt: now,
    updatedAt: now,
  }));

  // D1 binds at most 100 parameters per statement: 7 per row.
  const CHUNK_SIZE = 14;
  const inserts = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    inserts.push(db.insert(ahClues).values(rows.slice(i, i + CHUNK_SIZE)));
  }

  try {
    await db.batch([
      db.delete(ahClues).where(eq(ahClues.eventId, p.eventId)),
      ...inserts,
      auditInsert(db, {
        eventId: p.eventId,
        teamId: null,
        actorType: "ADMIN",
        actorId: p.adminId,
        action: "clues.replaced",
        targetType: "event",
        targetId: p.eventId,
        metadata: { count: rows.length, previousCount: previous?.count ?? 0 },
      }),
    ]);
  } catch (error) {
    console.error("[algohunt:clues] replace", error);
    return { ok: false, code: "CONFLICT", message: "Another change landed at the same time. Check again, then save." };
  }
  return { ok: true, count: rows.length };
}
