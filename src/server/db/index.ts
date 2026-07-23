import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Shared Drizzle client.
 *
 * - Dev / self-hosted: `DATABASE_URL` is a libSQL file (`file:./data/arena.db`).
 * - Edge deploy (recommended): point `DATABASE_URL` at a Turso database
 *   (`libsql://<db>.turso.io`) and set `DATABASE_AUTH_TOKEN`. libSQL speaks
 *   HTTP, so this same module-level client runs on Cloudflare Workers unchanged.
 *
 * Cloudflare D1 is the other option, but it's reached through a per-request
 * binding (`env.DB`) rather than a global URL, so it can't be a module
 * singleton — see DEPLOY.md for the `drizzle-orm/d1` + `getCloudflareContext()`
 * seam if you go that route.
 */
const url = process.env.DATABASE_URL ?? "file:./data/arena.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

export const db = drizzle(client, { schema });
