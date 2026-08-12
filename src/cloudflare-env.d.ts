// Augments the OpenNext `CloudflareEnv` with this app's Worker bindings.
// The inline `import(...)` keeps the @cloudflare/workers-types globals out of
// the global scope so they don't collide with the DOM lib types in tsconfig.
export {};

declare global {
  interface CloudflareEnv {
    /** Cloudflare D1 database binding (see wrangler.jsonc `d1_databases`). */
    DB: import("@cloudflare/workers-types").D1Database;
    /** R2 bucket for user avatar images (see wrangler.jsonc `r2_buckets`). */
    AVATARS: import("@cloudflare/workers-types").R2Bucket;
  }
}
