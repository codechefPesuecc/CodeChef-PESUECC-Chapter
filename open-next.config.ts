import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Serve prerendered/static pages (/, /team, /initiatives, /login, /leaderboard,
// /register, /reset, /verify) from the Workers ASSETS binding instead of re-running
// full React SSR on every request. Without a configured cache the adapter falls back
// to a "dummy" cache that misses on every request, so each hit paid ~230–680 ms of
// Worker CPU — a Cloudflare Error 1102 driver. `enableCacheInterception` lets the
// Worker short-circuit those routes with a cheap ASSETS fetch instead.
//
// force-dynamic routes (the arena, profile, and API routes that read D1 per request)
// are not in the prerender manifest, so they bypass the interceptor and behave exactly
// as before. The static-assets cache is read-only (pure SSG); if ISR/revalidation is
// ever added, switch to the KV or R2 incremental cache.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
