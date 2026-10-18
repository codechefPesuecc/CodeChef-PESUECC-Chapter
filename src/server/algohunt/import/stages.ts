import crypto from "node:crypto";
import { count, eq } from "drizzle-orm";
import type { ErrorCode } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { ahChallenges, ahStageProgress, ahStages, ahSubmissions, type AhEvent } from "@/server/db/schema";
import { auditInsert } from "../audit";
import { CONTENT_EDITABLE_STATUSES } from "./challenges";

/** One line of the question order: Question N is the question with this slug. */
export interface StageOrderRow {
  stageNumber: number;
  challengeSlug: string;
  points?: number;
}

export const DEFAULT_STAGE_POINTS = 100;

/** Errors block saving; warnings don't. Pure. */
export function validateStageOrder(
  rows: readonly StageOrderRow[],
  ctx: { slugs: ReadonlySet<string>; unverified?: ReadonlySet<string> },
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (rows.length === 0) errors.push("Add at least one question.");

  const numbers = rows.map((row) => row.stageNumber).sort((a, b) => a - b);
  if (numbers.some((n, i) => n !== i + 1)) errors.push(`Question numbers must be exactly 1 to ${rows.length}, with no gaps or repeats.`);

  const seen = new Set<string>();
  for (const row of rows) {
    if (!ctx.slugs.has(row.challengeSlug)) errors.push(`Question ${row.stageNumber}: '${row.challengeSlug}' isn't imported for this event.`);
    if (seen.has(row.challengeSlug)) errors.push(`'${row.challengeSlug}' is used more than once.`);
    seen.add(row.challengeSlug);
    if (row.points !== undefined && (!Number.isInteger(row.points) || row.points < 0 || row.points > 10_000)) {
      errors.push(`Question ${row.stageNumber}: points must be a whole number from 0 to 10000.`);
    }
    if (ctx.unverified?.has(row.challengeSlug)) warnings.push(`Question ${row.stageNumber} ('${row.challengeSlug}') isn't verified yet.`);
  }
  if (rows.length > 0 && rows.length < 3) warnings.push(`Only ${rows.length} question${rows.length === 1 ? "" : "s"} in the hunt.`);
  return { errors, warnings };
}

/** The event's imported questions by slug, and which of them still need verifying. */
export async function getChallengeSlugs(eventId: string): Promise<{
  ids: Map<string, string>;
  unverified: Set<string>;
}> {
  const rows = await getDb().select({ id: ahChallenges.id, slug: ahChallenges.slug, verifiedAt: ahChallenges.verifiedAt })
    .from(ahChallenges).where(eq(ahChallenges.eventId, eventId));
  return {
    ids: new Map(rows.map((row) => [row.slug, row.id])),
    unverified: new Set(rows.filter((row) => row.verifiedAt === null).map((row) => row.slug)),
  };
}

/**
 * Replace the whole question order in one batch. The last question is the final. Refused once the
 * event is live or any team has made progress (or submitted), because that progress points at the
 * old stages.
 */
export async function replaceStageOrder(p: { event: AhEvent; rows: StageOrderRow[]; adminId: string }): Promise<
  { ok: true; stages: number } | { ok: false; code: ErrorCode; message: string }
> {
  const { event } = p;
  if (!CONTENT_EDITABLE_STATUSES.has(event.status)) {
    return { ok: false, code: "CONFLICT", message: "The question order is frozen once the event has started." };
  }
  const db = getDb();
  const [[{ progress }], [{ submissions }], slugs] = await Promise.all([
    db.select({ progress: count() }).from(ahStageProgress).where(eq(ahStageProgress.eventId, event.id)),
    db.select({ submissions: count() }).from(ahSubmissions).where(eq(ahSubmissions.eventId, event.id)),
    getChallengeSlugs(event.id),
  ]);
  if (progress > 0 || submissions > 0) {
    return { ok: false, code: "CONFLICT", message: "Teams have already played this event, so its question order can't change." };
  }
  const check = validateStageOrder(p.rows, { slugs: new Set(slugs.ids.keys()) });
  if (check.errors.length > 0) return { ok: false, code: "VALIDATION", message: check.errors[0] };

  const now = Date.now();
  const last = p.rows.length;
  await db.batch([
    db.delete(ahStages).where(eq(ahStages.eventId, event.id)),
    db.insert(ahStages).values(p.rows.map((row) => ({
      id: crypto.randomUUID(),
      eventId: event.id,
      stageNumber: row.stageNumber,
      challengeId: slugs.ids.get(row.challengeSlug)!,
      points: row.points ?? DEFAULT_STAGE_POINTS,
      isFinal: row.stageNumber === last,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }))),
    auditInsert(db, {
      eventId: event.id, actorType: "ADMIN", actorId: p.adminId, action: "import.stages",
      targetType: "event", targetId: event.id, metadata: { count: last },
    }),
  ]);
  return { ok: true, stages: last };
}
