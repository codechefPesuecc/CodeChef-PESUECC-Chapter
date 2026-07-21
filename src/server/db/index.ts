import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Shared Drizzle client. `DATABASE_URL` is a libSQL URL — a local file in dev
 * (`file:./data/arena.db`) or in Docker (`file:/data/arena.db`), and a Turso
 * URL later if this moves to a hosted edge DB.
 */
const url = process.env.DATABASE_URL ?? "file:./data/arena.db";

const client = createClient({ url });

export const db = drizzle(client, { schema });
