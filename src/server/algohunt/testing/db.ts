// In DB-backed tests, set process.env.DATABASE_URL = ":memory:" before importing
// this module or calling getDb(). Call setupTestDb() once, then resetAlgoHuntTables()
// before each test that needs an empty AlgoHunt fixture.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "@/server/db";

let migrated = false;

export async function setupTestDb(): Promise<void> {
  if (migrated) return;
  await migrate(getDb() as Parameters<typeof migrate>[0], { migrationsFolder: "./migrations" });
  migrated = true;
}

export async function resetAlgoHuntTables(): Promise<void> {
  const db = getDb();
  for (const table of [
    "ah_code_attempts", "ah_audit_logs", "ah_disqualifications", "ah_announcements",
    "ah_volunteers", "ah_stage_progress", "ah_submissions", "ah_codes",
    "ah_code_batches", "ah_team_members", "ah_stages", "ah_test_cases",
    "ah_teams", "ah_challenges", "ah_events", "rate_limits",
  ]) {
    await db.run(sql.raw(`DELETE FROM ${table}`));
  }
}
