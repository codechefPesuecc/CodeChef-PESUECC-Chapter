import { drizzle as drizzleD1, type DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle as drizzleLibSQL } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * Request-scoped Drizzle client.
 *
 * - **Cloudflare Workers (prod):** the database is a Cloudflare **D1** binding
 *   (`env.DB`), reached per request through `getCloudflareContext()`. D1 is a
 *   binding, not a URL, so the client can't be a module singleton — always call
 *   `getDb()` inside the request/handler.
 * - **Node dev / build / prerender:** there's no Cloudflare context, so we fall
 *   back to a cached **libSQL** client (`DATABASE_URL`, a local file by default).
 *   This keeps `npm run dev` working exactly as before, no wrangler needed.
 *
 * Both drivers target SQLite, so Drizzle's query API is identical; the libSQL
 * client is surfaced through the same D1-typed shape for a single call-site type.
 */
export type AppDatabase = DrizzleD1Database<typeof schema>;

let devDb: AppDatabase | null = null;

function devDatabase(): AppDatabase {
  if (!devDb) {
    const url = process.env.DATABASE_URL ?? "file:./data/arena.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    const client = createClient(authToken ? { url, authToken } : { url });
    // Same SQLite surface as D1 at runtime; cast to unify the call-site type.
    devDb = drizzleLibSQL(client, { schema }) as unknown as AppDatabase;
  }
  return devDb;
}

/** The Drizzle client for the current request (D1 on Workers, libSQL in dev). */
export function getDb(): AppDatabase {
  try {
    const { env } = getCloudflareContext();
    if (env?.DB) return drizzleD1(env.DB, { schema });
  } catch {
    // Not inside a Cloudflare request scope (next dev / build / prerender).
  }
  return devDatabase();
}
