import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

/**
 * Applies pending migrations from ./migrations. Idempotent (Drizzle tracks what
 * has run), so it's safe to call on every server start — see instrumentation.ts.
 */
export async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("[db] migrations up to date");
  } catch (error) {
    console.error("[db] migration failed:", error);
  }
}
