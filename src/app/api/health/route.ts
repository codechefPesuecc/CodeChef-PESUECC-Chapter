import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { judgeQueueStats, judgeHealth } from "@/lib/judge";

// Always run at request time � this checks live dependencies.
export const dynamic = "force-dynamic";

/**
 * Stack health check: verifies the SQLite DB and the Rust Judge Sandbox are both
 * reachable. Returns 200 only when the whole stack is up, 503 otherwise.
 */
export async function GET() {
  const checks: {
    db: boolean;
    judge: boolean;
    workers?: number;
    idleWorkers?: number;
    queuedJobs?: number;
  } = { db: false, judge: false };

  try {
    const db = getDb();
    await db.run(sql`select 1`);
    checks.db = true;
  } catch {
    checks.db = false;
  }

  try {
    const health = await judgeHealth();
    checks.judge = true;
    checks.workers = health.total_workers;
    checks.idleWorkers = health.idle_workers;
    checks.queuedJobs = health.queued_jobs;
  } catch {
    checks.judge = false;
  }

  const ok = checks.db && checks.judge;
  return NextResponse.json(
    { ok, ...checks, judgeQueue: judgeQueueStats(), at: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}