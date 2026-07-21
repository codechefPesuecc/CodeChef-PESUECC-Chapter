import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { pistonQueueStats, pistonRuntimes } from "@/lib/piston";

// Always run at request time — this checks live dependencies.
export const dynamic = "force-dynamic";

/**
 * Stack health check: verifies the SQLite DB and the Piston sandbox are both
 * reachable. Returns 200 only when the whole stack is up, 503 otherwise.
 */
export async function GET() {
  const checks = { db: false, piston: false, runtimes: [] as string[] };

  try {
    await db.run(sql`select 1`);
    checks.db = true;
  } catch {
    checks.db = false;
  }

  try {
    const runtimes = await pistonRuntimes();
    checks.piston = true;
    checks.runtimes = runtimes.map((r) => `${r.language}@${r.version}`);
  } catch {
    checks.piston = false;
  }

  const ok = checks.db && checks.piston;
  return NextResponse.json(
    { ok, ...checks, judgeQueue: pistonQueueStats(), at: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
