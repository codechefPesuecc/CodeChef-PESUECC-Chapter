import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Applies pending migrations from ./migrations against the local libSQL/SQLite
 * database. Idempotent (Drizzle tracks what has run), so it's safe to call on
 * every server start — see instrumentation.ts.
 *
 * This is a dev/self-hosted convenience only. On Cloudflare the database is D1,
 * migrated out-of-band (`wrangler d1 migrations apply`), and instrumentation.ts
 * skips this entirely on the Workers runtime. It builds its own libSQL client so
 * it never depends on the request-scoped `getDb()`.
 */
export async function runMigrations() {
  try {
    const url = process.env.DATABASE_URL ?? "file:./data/arena.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    const client = createClient(authToken ? { url, authToken } : { url });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("[db] migrations up to date");
  } catch (error) {
    console.error("[db] migration failed:", error);
  }
}
