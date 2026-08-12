import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { rateLimits } from "@/server/db/schema";

/**
 * Fixed-window rate limiter backed by the database (D1 in prod, the libSQL file
 * in dev). It lives in the DB rather than process memory because each Cloudflare
 * Worker isolate has its own memory — an in-memory counter wouldn't hold across
 * isolates, so the limit could be trivially bypassed. Keys look like
 * `login:user:alice` or `run:ip:1.2.3.4`.
 *
 * The count is bumped in a single atomic upsert (INSERT ... ON CONFLICT DO
 * UPDATE with the arithmetic done DB-side) so concurrent requests to the same
 * key can't lose an update and slip past the limit. A window whose `resetAt`
 * has already passed is restarted at 1 in the same statement.
 *
 * Fails open: if the store errors we allow the request rather than lock users
 * out — the limiter is abuse mitigation, not an auth gate, so a transient D1
 * error shouldn't take login/submit down for everyone.
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
  const resetAt = now + windowMs;
  try {
    // Count this request atomically: start a fresh window at 1 if none exists or
    // the previous one elapsed, else increment. RETURNING gives the resulting
    // count, so there's no read-modify-write race between concurrent requests.
    const rows = await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} <= ${now} then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

    const row = rows[0];
    const count = row?.count ?? 1;
    const windowEnd = row?.resetAt ?? resetAt;
    if (count > limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, windowEnd - now) };
    }
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
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
