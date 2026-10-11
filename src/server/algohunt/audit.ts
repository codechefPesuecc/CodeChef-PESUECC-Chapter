/**
 * AlgoHunt audit log helpers — local mock until Module 1 lands.
 * Module 1 owns the real implementation; this stub is deleted when M1 merges.
 *
 * Real implementation: src/server/algohunt/audit.ts (M1)
 */
import type { ActorType, AuditAction } from "@/lib/algohunt/types";

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

/**
 * Write a single audit log entry. Never throws (logs instead).
 * TODO(M1): Replace with real DB implementation.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  // M1 stub: log to console until M1 lands.
  console.info("[algohunt:audit]", entry.action, entry.metadata ?? {});
}
