import { and, ne, sql, type SQL } from "drizzle-orm";
import { ahAuditLogs } from "@/server/db/schema";

/**
 * Audit rows the feed and the team timeline skip because another row already tells the same story:
 * a judged submission has its own submission row, and a completion by code or override is already
 * described by code.redeemed / override.complete_stage.
 */
export const feedAuditFilter: SQL = and(
  ne(ahAuditLogs.action, "submission.judged"),
  sql`NOT (${ahAuditLogs.action} = 'stage.completed' AND json_extract(${ahAuditLogs.metadata}, '$.via') IN ('CODE', 'OVERRIDE'))`,
)!;
