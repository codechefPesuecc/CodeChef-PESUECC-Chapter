import crypto from "node:crypto";
import type { ActorType, AuditAction } from "@/lib/algohunt/types";
import { getDb, type AppDatabase } from "@/server/db";
import { ahAuditLogs } from "@/server/db/schema";

export interface AuditEntry {
  eventId: string | null;
  teamId?: string | null;
  actorType: ActorType;
  actorId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const forbiddenKeys = new Set(["password", "code", "submittedcode", "secret", "source"]);

function safeMetadata(value: unknown): unknown {
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) return value.map(safeMetadata);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !forbiddenKeys.has(key.toLowerCase()))
        .map(([key, nested]) => [key, safeMetadata(nested)]),
    );
  }
  return value;
}

/** Return an unawaited insert so it can participate in the caller's db.batch(). */
export function auditInsert(db: AppDatabase, entry: AuditEntry) {
  return db.insert(ahAuditLogs).values({
    id: crypto.randomUUID(),
    eventId: entry.eventId,
    teamId: entry.teamId ?? null,
    actorType: entry.actorType,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: JSON.stringify(safeMetadata(entry.metadata ?? {})),
    ip: entry.ip ?? null,
    userAgent: entry.userAgent?.slice(0, 300) ?? null,
    createdAt: Date.now(),
  });
}

/** Standalone audit writes are best effort; an audit error must not break gameplay. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await auditInsert(getDb(), entry);
  } catch (error) {
    console.error("[algohunt:audit]", error);
  }
}
