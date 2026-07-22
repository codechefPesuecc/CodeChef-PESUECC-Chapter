/**
 * In-memory sliding-window rate limiter. Fine for the single-process Node server
 * that runs the judge; a multi-instance or edge deployment would need a shared
 * store (Cloudflare KV / Durable Object) — see the Cloudflare deploy notes.
 */

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, hits[0] + windowMs - now),
    };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, remaining: limit - hits.length, retryAfterMs: 0 };
}

/** Best-effort client IP from proxy headers (dev falls back to "local"). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
