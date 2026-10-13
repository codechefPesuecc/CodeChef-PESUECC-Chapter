import { sql } from "drizzle-orm";
import { judgeHealth } from "@/lib/judge";
import { getDb } from "@/server/db";

export interface AdminHealth {
  judge:
    | { ok: true; idle: number; busy: number; queued: number; workers: number; latencyMs: number }
    | { ok: false; error: string };
  db: { ok: boolean; latencyMs: number };
}

const JUDGE_TIMEOUT_MS = 5_000;

export async function getHealth(): Promise<AdminHealth> {
  const [judge, db] = await Promise.all([checkJudge(), checkDb()]);
  return { judge, db };
}

async function checkJudge(): Promise<AdminHealth["judge"]> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Judge health timed out")), JUDGE_TIMEOUT_MS);
    });
    const health = await Promise.race([judgeHealth(), timeout]);
    return {
      ok: true,
      idle: health.idle_workers,
      busy: health.busy_workers,
      queued: health.queued_jobs,
      workers: health.total_workers,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    // The judge URL and headers stay server-side; admins only see a fixed message.
    console.error("[algohunt:health] judge", error instanceof Error ? error.message : error);
    return { ok: false, error: "Judge unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

async function checkDb(): Promise<AdminHealth["db"]> {
  const started = Date.now();
  try {
    await getDb().run(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[algohunt:health] db", error instanceof Error ? error.message : error);
    return { ok: false, latencyMs: Date.now() - started };
  }
}
