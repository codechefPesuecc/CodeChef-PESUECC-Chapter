import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { rateLimits } from "@/server/db/schema";

/**
 * Fixed-window rate limiter backed by the database (D1 in prod, the libSQL file
 * in dev). It lives in the DB rather than process memory because each Cloudflare
 * Worker isolate has its own memory — an in-memory counter wouldn't hold across
 * isolates, so the limit could be trivially bypassed. Keys look like
 * `login:user:alice` or `run:ip:1.2.3.4`.
 *
 * Fails open: if the store errors we allow the request rather than lock users
 * out. Windows are short, so stale rows are simply overwritten on the next hit
 * for the same key (row count is bounded by the number of distinct keys).
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const db = getDb();
  const now = Date.now();
  try {
    const rows = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);
    const row = rows[0];

    // No window yet, or the previous one has elapsed → start a fresh window.
    if (!row || now >= row.resetAt) {
      const resetAt = now + windowMs;
      await db
        .insert(rateLimits)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { count: 1, resetAt },
        });
      return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    if (row.count >= limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, row.resetAt - now) };
    }

    await db
      .update(rateLimits)
      .set({ count: row.count + 1 })
      .where(eq(rateLimits.key, key));
    return { ok: true, remaining: Math.max(0, limit - row.count - 1), retryAfterMs: 0 };
  } catch (e) {
    // Availability over strict limiting — don't lock users out on a store hiccup.
    console.error("[rateLimit] store error:", e);
    return { ok: true, remaining: limit, retryAfterMs: 0 };
  }
}

/**
 * Best-effort client IP. On Cloudflare the trustworthy value is
 * `CF-Connecting-IP`; the `x-forwarded-for` fallback covers other proxies and
 * dev. Falls back to a constant so a missing header can't split one client into
 * many un-limited buckets.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Standard 429 response for a tripped limit (used by the auth routes). */
export function rateLimitedResponse(retryAfterMs: number): NextResponse {
  const s = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    {
      ok: false,
      error: `Too many attempts — try again in ${s}s.`,
      rateLimited: true,
    },
    { status: 429, headers: { "Retry-After": String(s) } },
  );
}

/**
 * Applies several rate-limit checks and returns a 429 response if any trips,
 * else null. Each check is `[key, limit, windowMs]`.
 */
export async function enforceRateLimits(
  checks: Array<[string, number, number]>,
): Promise<NextResponse | null> {
  let worstRetry = 0;
  let tripped = false;
  for (const [key, limit, windowMs] of checks) {
    const r = await rateLimit(key, limit, windowMs);
    if (!r.ok) {
      tripped = true;
      worstRetry = Math.max(worstRetry, r.retryAfterMs);
    }
  }
  return tripped ? rateLimitedResponse(worstRetry) : null;
}
