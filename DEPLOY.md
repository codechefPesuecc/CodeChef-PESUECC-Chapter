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

## 1. One-time setup

```bash
npm i -D @opennextjs/cloudflare wrangler
```

Add `open-next.config.ts` at the repo root:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
```

`wrangler.jsonc` is already committed (name, assets, `nodejs_compat`).

## 2. Database

### Option A — Turso (recommended, no code change)

The db client (`src/server/db/index.ts`) already supports this: it uses
`DATABASE_URL` + optional `DATABASE_AUTH_TOKEN`, and libSQL speaks HTTP so the
module-level client works on Workers.

```bash
turso db create pesuecc-arena
turso db show pesuecc-arena --url          # -> DATABASE_URL (libsql://…)
turso db tokens create pesuecc-arena       # -> DATABASE_AUTH_TOKEN

# Apply the committed migrations (SQLite DDL):
turso db shell pesuecc-arena < migrations/0000_*.sql
turso db shell pesuecc-arena < migrations/0001_*.sql
# (or point drizzle-kit at the Turso URL and `npm run db:migrate`)
```

Set the secrets (see §5). Nothing else changes.

### Option B — Cloudflare D1

D1 is SQLite, so the committed `/migrations` apply unchanged, but it's reached
through a **per-request binding** (`env.DB`), not a URL — so `db` can't stay a
module singleton. Uncomment the `d1_databases` block in `wrangler.jsonc`, then:

```bash
npx wrangler d1 create pesuecc-arena       # copy the database_id into wrangler.jsonc
npx wrangler d1 migrations apply pesuecc-arena --remote
```

Refactor `src/server/db` to build the client per request:

```ts
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}
```

and replace `import { db }` call sites with `getDb()`. This is why Turso is the
lighter path for a first deploy.

## 3. Judge / Piston

Workers can't run the Docker sandbox. Host Piston on a small VM (Fly.io, Render,
a cheap VPS) exactly as `docker-compose.yml` does, expose it over HTTPS, and set
`PISTON_URL` to that origin. `/api/run` and `/api/submit` already read
`PISTON_URL`, so no code change — just the secret. Without a reachable Piston,
Run/Submit return a 503 "judge unreachable" and the rest of the site works.

## 4. Challenges & hidden tests

`src/lib/challenges.ts` reads `/challenges/*.json` from the filesystem. On
Workers there's no `fs`, so either:

- **Bundle them** — import the JSON at build time (e.g. an `import.meta.glob`
  style manifest) so they're in the worker bundle, or
- **Move them to the DB** — a `challenges` table in Turso/D1, seeded from the
  JSON, read like everything else. This also lets you schedule releases without
  a redeploy.

Keep the repo private either way — the hidden tests live in it.

## 5. Secrets

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put DATABASE_URL
npx wrangler secret put DATABASE_AUTH_TOKEN     # Turso
npx wrangler secret put PISTON_URL
npx wrangler secret put RESEND_API_KEY          # if email verification is on
npx wrangler secret put TURNSTILE_SECRET_KEY    # if Turnstile is on
```

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
- **In-memory state is per-isolate.** The submit/run rate limiter
  (`src/server/rateLimit.ts`) and Piston's FIFO job queue live in one process's
  memory; across many Worker isolates they won't share counts. For strict global
  limits move the limiter to a Durable Object or KV. The per-account cap still
  meaningfully curbs abuse as-is.
