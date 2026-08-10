# Deploying the Arena to Cloudflare

The app runs on Cloudflare Workers via the [OpenNext Cloudflare
adapter](https://opennext.js.org/cloudflare). Two pieces don't move to the edge
as-is and need decisions up front:

1. **Database** — the edge has no local SQLite file. Use **Turso** (libSQL over
   HTTP, recommended — zero code change) or **Cloudflare D1** (needs a
   per-request binding refactor).
2. **Judge (Piston)** — Workers can't run Docker, so the sandbox must be hosted
   elsewhere and reached over HTTPS. Local Docker Piston stays a dev-only judge.

Everything else (auth, sessions, leaderboards, OTP, rate limits) is portable
with `nodejs_compat`.

## 1. One-time setup (done)

The adapter (`@opennextjs/cloudflare`), `wrangler`, and `@cloudflare/workers-types`
are in `devDependencies`; `open-next.config.ts` and `wrangler.jsonc` (name, assets,
`nodejs_compat`, the D1 binding) are committed. Next is pinned to `^16.2.12`, the
first patch the adapter supports. Nothing to install — `npm install` covers it.

## 2. Database — Cloudflare D1 (implemented)

The app uses **Cloudflare D1**. `src/server/db/index.ts` exposes `getDb()`, which
reads the `DB` binding per request via `getCloudflareContext()` on Workers, and
falls back to a local libSQL file (`DATABASE_URL`) under `next dev` / `next build`
so local development needs no wrangler. All call sites use `getDb()`, and the
`d1_databases` binding is already in `wrangler.jsonc` (fill in the id).

D1 is SQLite, so the committed `/migrations` apply unchanged:

```bash
npx wrangler d1 create pesuecc-arena        # paste the printed database_id into wrangler.jsonc
npx wrangler d1 migrations apply pesuecc-arena --remote    # prod
npx wrangler d1 migrations apply pesuecc-arena --local     # local wrangler dev/preview
```

`src/instrumentation.ts` skips the local libSQL auto-migrator on the Workers
runtime, so D1 is only ever migrated out-of-band by the commands above.

## 3. Judge / Piston

Workers can't run the Docker sandbox. Host Piston on a small VM (Fly.io, Render,
a cheap VPS) exactly as `docker-compose.yml` does, expose it over HTTPS, and set
`PISTON_URL` to that origin. `/api/run` and `/api/submit` already read
`PISTON_URL`, so no code change — just the secret. Without a reachable Piston,
Run/Submit return a 503 "judge unreachable" and the rest of the site works.

## 4. Challenges & hidden tests (implemented — bundled)

Workers have no `fs`, so the `/challenges/*.json` records are **bundled at build
time**. `scripts/build-challenges.mjs` reads the folder into
`src/lib/challenges.manifest.json`, and `next.config.ts` invokes it for `next dev`,
`next build`, and `opennextjs-cloudflare build` alike. `src/lib/challenges.ts`
imports that manifest instead of touching the filesystem; the GitOps authoring
flow (one JSON per problem, author → PR → merge) is unchanged.

Publishing a new problem is a **redeploy** (the manifest is baked into the bundle).
Run `npm run challenges:build` to refresh the manifest locally; it's also
regenerated automatically on every build. Keep the repo private — the hidden
tests ride in the bundle (server-side only, never sent to the client).

## 5. Secrets

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put PISTON_URL
npx wrangler secret put RESEND_API_KEY          # if email verification is on
npx wrangler secret put TURNSTILE_SECRET_KEY    # if Turnstile is on
```

The database needs no secret — D1 is the `DB` binding in `wrangler.jsonc`.
`DATABASE_URL` / `DATABASE_AUTH_TOKEN` are only used by the local dev fallback.

`NEXT_PUBLIC_*` values (e.g. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) are build-time —
set them in the build environment, not as secrets. Turn on
`REQUIRE_EMAIL_VERIFICATION` as a plain var once email is configured.

## 6. Build & deploy

```bash
npx opennextjs-cloudflare build
npx wrangler deploy
# preview locally on the workerd runtime:
npx wrangler dev
```

## Caveats on the edge

- **Migrations** don't auto-run at the edge — `src/instrumentation.ts` applies
  them against the local file in dev only. Apply them out-of-band (Turso shell /
  `wrangler d1 migrations apply`) before/at deploy.
- **Rate limiting is DB-backed** (`src/server/rateLimit.ts` → the `rate_limits`
  table), so limits hold across Worker isolates. Applied to run/submit and the
  auth endpoints (login/register/forgot/resend). Piston's FIFO job queue is still
  per-isolate in-memory — acceptable, and only relevant once the judge is live.
- **Security headers + CSP** ship from `next.config.ts` (`headers()`). The CSP
  uses `'unsafe-inline'` for scripts/styles (Next bootstrap + CodeMirror); tighten
  to nonces later if desired.
- **Sessions carry a `sessionEpoch`** that a password reset bumps, so a reset
  invalidates every outstanding session. New migrations (e.g. `0003`) must be
  applied to D1 (`wrangler d1 migrations apply … --remote`) before/at deploy.
