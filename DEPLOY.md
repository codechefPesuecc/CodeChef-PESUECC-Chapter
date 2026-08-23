# Deploying the Arena to Cloudflare

The app runs on Cloudflare Workers via the [OpenNext Cloudflare
adapter](https://opennext.js.org/cloudflare). Two pieces don't move to the edge
as-is and need decisions up front:

1. **Database** — the edge has no local SQLite file. Use **Turso** (libSQL over
   HTTP, recommended — zero code change) or **Cloudflare D1** (needs a
   per-request binding refactor).
2. **Judge Sandbox** — Workers can't run Docker, so the sandbox must be hosted
   elsewhere (e.g. Azure VM, cheap VPS) and reached over HTTPS. Local Docker Judge Sandbox stays a dev-only judge.

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

## 3. Judge Sandbox

Workers can't run the Docker sandbox. Host the Rust Judge Sandbox on a small VM (Azure,
Fly.io, Render, a cheap VPS), expose it over HTTPS, and set `JUDGE_URL` to that origin.
`/api/run` and `/api/submit` read `JUDGE_URL`. Without a reachable judge sandbox,
Run/Submit return a 502 "execution failed" and the rest of the site works.

**`JUDGE_URL` must be a hostname, not a bare IP.** Cloudflare Workers reject
`fetch()` to a raw IP address with `403 error code: 1003` ("Direct IP Access Not
Allowed"), which surfaces as a 502 on Run/Submit. Give the VM a DNS name and serve
HTTPS. Current setup: the judge runs on an Azure VM (`20.219.186.217:8080`, bound to
localhost) behind Caddy, which terminates TLS and reverse-proxies to it. `JUDGE_URL`
is `https://20.219.186.217.nip.io` (nip.io resolves the hostname back to the VM's IP,
so no DNS records are needed). A Cloudflare Tunnel to `localhost:8080` is an
alternative that avoids exposing any public port.

## 4. Challenges (in D1 — seeded)

Problems live in the `challenges` table, not the bundle. Author each problem as a
JSON file, validate it, and load it into D1 with the seed script:

```bash
npm run challenges:validate
npm run challenges:seed                      # local dev DB (data/arena.db)
npm run challenges:seed -- --target remote   # production D1 (via wrangler)
```

Publishing a problem is a **database write, not a redeploy** — the seed upserts on
`slug`, so re-running reflects edits and preserves the original publish time. The
Problem of the Day is the most recent released problem whose `date` (IST) is on or
before today. Hidden tests live only in D1: the authoring JSON is git-ignored, so
they never enter the repo or the client bundle, and a problem's `tests`/`checker`
are selected only by the judge.

## 5. Secrets

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put JUDGE_URL
# email OTP verification — the Gmail API transport (all three required):
npx wrangler secret put GMAIL_CLIENT_ID
npx wrangler secret put GMAIL_CLIENT_SECRET
npx wrangler secret put GMAIL_REFRESH_TOKEN
npx wrangler secret put TURNSTILE_SECRET_KEY    # if Turnstile is on
```

The database needs no secret — D1 is the `DB` binding in `wrangler.jsonc`.
`DATABASE_URL` / `DATABASE_AUTH_TOKEN` are only used by the local dev fallback.

`NEXT_PUBLIC_*` values (e.g. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) are build-time —
set them in the build environment, not as secrets. Email sends via the Gmail API
(`src/server/email.ts`): set the three `GMAIL_*` secrets above plus `EMAIL_FROM`,
then turn on `REQUIRE_EMAIL_VERIFICATION` — never before, or new users get an OTP
that's only logged server-side, never delivered, and can't finish signing up.

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
  auth endpoints (login/register/forgot/resend). The judge sandbox queue bounds
  execution safely across nodes.
- **Security headers + CSP** ship from `next.config.ts` (`headers()`). The CSP
  uses `'unsafe-inline'` for scripts/styles (Next bootstrap + CodeMirror); tighten
  to nonces later if desired.
- **Sessions carry a `sessionEpoch`** that a password reset bumps, so a reset
  invalidates every outstanding session. New migrations (e.g. `0003`) must be
  applied to D1 (`wrangler d1 migrations apply … --remote`) before/at deploy.
