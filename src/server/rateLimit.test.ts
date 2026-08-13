// Drive the real limiter against an in-memory libSQL DB (getDb falls back to
// DATABASE_URL when there's no Cloudflare context). Set the URL before the first
// getDb() call so the cached client points at :memory:.
process.env.DATABASE_URL = ":memory:";

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimit } from "./rateLimit";

const db = getDb();

beforeAll(async () => {
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS rate_limits (key text primary key, count integer not null default 0, reset_at integer not null)`,
  );
});

beforeEach(async () => {
  await db.run(sql`DELETE FROM rate_limits`);
});

describe("rateLimit", () => {
  it("allows up to the limit, then blocks with a retry-after", async () => {
    const key = "test:basic";
    const r1 = await rateLimit(key, 3, 60_000);
    const r2 = await rateLimit(key, 3, 60_000);
    const r3 = await rateLimit(key, 3, 60_000);
    const r4 = await rateLimit(key, 3, 60_000);
    expect([r1.ok, r2.ok, r3.ok]).toEqual([true, true, true]);
    expect(r1.remaining).toBe(2);
    expect(r4.ok).toBe(false);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it("counts every hit exactly once (no lost updates)", async () => {
    const key = "test:count";
    const results = await Promise.all(
      Array.from({ length: 10 }, () => rateLimit(key, 5, 60_000)),
    );
    expect(results.filter((r) => r.ok).length).toBe(5);
  });

  it("restarts the window once resetAt has passed", async () => {
    const key = "test:window";
    const first = await rateLimit(key, 1, 60_000);
    const blocked = await rateLimit(key, 1, 60_000);
    expect(first.ok).toBe(true);
    expect(blocked.ok).toBe(false);

    // Force the current window to look expired.
    await db.run(
      sql`UPDATE rate_limits SET reset_at = ${Date.now() - 1000} WHERE key = ${key}`,
    );
    const afterReset = await rateLimit(key, 1, 60_000);
    expect(afterReset.ok).toBe(true);
  });
});
