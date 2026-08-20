@AGENTS.md

# CodeChef PESUECC Chapter — Project Guide

Detailed reference for this codebase. `@AGENTS.md` (above) carries the critical caveat: this is **Next.js 16** with breaking changes from older versions — read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## 1. What this is

The website + platform for the **CodeChef PESU ECC (Electronic City Campus)** student chapter. One Next.js app, two halves:

- **Marketing site** — home, team, initiatives (events/systems) — statically prerendered.
- **CP Arena** — a competitive-programming "Problem of the Day" (POTD) platform: accounts, an in-browser code editor + judge, speed-bounty scoring, leaderboards, and an admin console to author problems.

Deployed to **Cloudflare Workers** (edge) via the OpenNext adapter, backed by **Cloudflare D1** (SQLite). Live at https://codechef.pesuecc.workers.dev.

## 2. Tech stack & runtime

- **Next.js 16** (App Router, Turbopack, React 19). ⚠️ Breaking changes vs older Next — see `@AGENTS.md`.
- **@opennextjs/cloudflare** (v1.20.x) — builds the Next app into a Cloudflare Worker (`.open-next/worker.js`).
- **Cloudflare Workers** (workerd, `nodejs_compat`). This is **not Node** — there are subtle runtime differences (see §15).
- **Cloudflare D1** (SQLite) in prod; **libSQL** file (`./data/arena.db`) in local dev. Same **Drizzle ORM** API for both.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`).
- **Piston** (self-hosted execution sandbox) for judging — local Docker in dev, an external Piston host in prod.
- **Vitest** (unit tests), **ESLint** (next core-web-vitals + TS).
- **Gmail API** for transactional email (OTP + password reset).

## 3. Repository layout

```
src/
  app/
    (root)               # /, /login, /register, /reset, /forgot, /verify, /leaderboard — mostly static
    cp-arena/            # listing + solve/[slug] + archive/[slug] (force-dynamic; reads D1)
    admin/               # /admin, /admin/problems/new, /admin/problems/[slug]/edit — admin-gated
    profile/             # signed-in user's submissions + stats
    team/  initiatives/  # static; built from content/ into *.manifest.json
    api/
      auth/              # login, register, verify, reset, forgot, resend, me, logout
      admin/             # problems (CRUD), preview — admin-gated
      run/               # execute vs custom stdin (unauth, IP-limited) — records nothing
      submit/            # judge vs hidden tests (auth) — records + scores
      attempt/start/     # records when a user opened today's POTD (speed clock)
      leaderboard/  health/
  components/
    auth/                # login/register/etc forms + useUser() client hook
    cp-arena/            # ArenaWorkspace, CodeEditor (CodeMirror), ProblemStatement, Leaderboard*, ArenaRules
    admin/               # ProblemForm, DeleteProblemButton
    ui/  Navbar.tsx  Footer.tsx ...
  server/
    auth/                # session.ts, token.ts, password.ts, verification.ts, reset.ts
    db/                  # index.ts (getDb), schema.ts, migrate.ts
    judge.ts             # run a submission vs hidden tests via Piston → verdict
    leaderboard.ts profile.ts solves.ts rateLimit.ts email.ts emailTemplates.ts turnstile.ts limits.ts
  lib/
    challenges.ts        # D1 readers (getChallengeBySlug/getDailyChallenge/getAdminChallengeList) + IST dates
    challenge-schema.ts  # shared zod ChallengeSchema (+ AdminChallengeSchema); pure, no fs
    challenge-persist.ts # toChallengeRow(): validated input → DB row (+ renders content_html)
    markdown.ts          # renderMarkdown(): sanitized Markdown→HTML (unified/remark/rehype)
    piston.ts scoring.ts points.ts
  instrumentation.ts     # register(): auto-applies DB migrations on dev startup (skipped on Workers)
scripts/                 # seed-challenges, validate-challenges, challenge-schema (Node bits), build-team, build-initiatives
migrations/              # Drizzle SQL (0001..0007)
content/                 # team.json + initiatives markdown (source for manifests)
challenges/              # problem JSON authoring source — GITIGNORED (holds hidden tests); README.md tracked
```

## 4. Data model (D1 / Drizzle — `src/server/db/schema.ts`)

- **users** — `id` (uuid PK), `username` (unique public identity), `name`, `email` (unique), `emailVerified`, `srn` (unique, nullable), `prn` (unique, required), `passwordHash`, `sessionEpoch` (bumped on reset → invalidates old sessions), **`isAdmin`**, `createdAt`.
- **challenges** — `slug` (PK), `title`, `difficulty`, `tags` (JSON), `date` (YYYY-MM-DD IST = the release key), `timeLimit`, `memoryLimit`, `author`, `statement`/`inputFormat`/`outputFormat`/`constraints` (Markdown), `samples` (JSON, public), **`contentHtml`** (JSON of pre-rendered sanitized HTML — served instead of rendering per request), `tests` (JSON — **SECRET**, judge-only), `checker` (JSON `{type: exact|token|float, epsilon?}`), `schemaVersion`, `createdAt`, `updatedAt`.
- **submissions** — `id`, `challengeSlug`, `userId`, `language`, `code`, `status` (AC/WA/TLE/RE/CE/pending), `runtimeMs`, `elapsedSeconds` (server-computed solve time), `flags` + `flagsBreakdown` (integrity signals), **`ranked`** (true = live POTD/speed-bounty; false = past/practice), `createdAt` (authoritative server time).
- **attempts** — one immutable row per (user, challenge): `startedAt` = first open of the ranked POTD. Official solve time = AC `createdAt` − `startedAt` (unspoofable). Unique(userId, challengeSlug).
- **emailVerifications** — OTP codes hashed at rest (fast salted SHA-256, `sha256$…`), one active row/user, 10-min TTL, attempt cap, resend cooldown.
- **passwordResets** — single-use reset tokens (hashed).
- **rateLimits** — fixed-window counters (`key` PK, `count`, `resetAt`) — DB-backed so limits hold across isolates.

**Migrations**: `npm run db:generate` (Drizzle diff → `migrations/000N_*.sql`). Prod: `npx wrangler d1 migrations apply pesuecc-arena --remote`. Dev auto-applies via `src/instrumentation.ts`.

## 5. DB access — `src/server/db/index.ts`

`getDb()`: in a Cloudflare request it reads the `DB` binding via `getCloudflareContext()` (D1); otherwise (dev/build/prerender) it falls back to a cached libSQL client (`DATABASE_URL` or `file:./data/arena.db`). ⚠️ Drizzle `.select().from(table)` emits an **explicit column list from the schema** — adding a schema column means every select now references it (see the migration-ordering gotcha, §14).

## 6. Authentication — `src/server/auth/`

- **Stateless sessions**: a signed cookie `arena_session` = `userId:epoch:expiry` HMAC-signed with `AUTH_SECRET` (`token.ts`). No sessions table. A password reset bumps `sessionEpoch`, invalidating every outstanding token.
- **`getCurrentUser()`** (`session.ts`) → `SessionUser | null`. **`getAdminUser()`** → null unless `isAdmin`. Server code uses these; the client uses the **`useUser()`** hook (fetches `/api/auth/me`).
- **Password hashing** (`password.ts`): **PBKDF2-HMAC-SHA256** (WebCrypto), format `pbkdf2$<iters>$<salt>$<hash>`. ⚠️ **iterations MUST stay ≤ 100000** — prod rejects more (§15). `verifyPassword` also handles legacy scrypt (`salt:hash`) and returns `needsRehash` so login upgrades them; it **fails closed** (never throws) if a derivation is rejected. Login runs a cached dummy-hash "timing equalizer" so a missing username isn't faster than a wrong password.
- **Email OTP** (`verification.ts`): 6-digit codes, salted SHA-256 at rest (not a slow KDF — the rate limit + expiry are the real guard).

## 7. CP Arena

**Problems** live in **D1**, not the repo — publishing is an insert, not a redeploy. Source is `challenges/*.json` (gitignored); `npm run challenges:seed` validates with the shared zod schema and upserts, **rendering `content_html` at seed time**. A challenge is "released" once its IST `date` arrives — future-dated rows (and their hidden tests) are never served. IST logic (`todayStr`, `istYearMonth`) lives in `src/lib/challenges.ts` — the chapter runs on India time; POTD rolls at IST midnight.

**Solve page** `/cp-arena/solve/[slug]` (force-dynamic): `ProblemStatement` renders the **stored `content_html`** (no per-request Markdown). Once a user has a ranked AC on today's POTD they can't reopen it until it's a past problem (hide-after-solve).

**Judging** — `src/server/judge.ts` + `src/lib/piston.ts`:
- **`/api/run`** (unauth, IP-limited): run vs custom stdin, record nothing.
- **`/api/submit`** (auth, email-verified if required): `judge()` runs the code through **Piston** for each hidden test with the problem's limits, compares output via the checker (token/exact/float), returns the first-failing verdict or AC, records the submission, and (for ranked ACs) computes the official solve time + speed-bounty rank. **503** if Piston is unreachable.
- **Piston**: `PISTON_URL` (default `http://localhost:2000`); dev runs it in Docker (`piston:up`, `piston:install`). `piston.ts` bounds concurrency (FIFO queue).

**WASM Client-Side Execution** — `src/lib/wasmExecution.ts` + `scripts/wasmCompiler.mjs`:
- **Compiler service** (`scripts/wasmCompiler.mjs`): Node.js Express server compiling C/C++/Go/Rust/Java to WebAssembly. Runs on `http://localhost:3001` (dev) or `WASM_COMPILER_URL` env (prod).
  - **In-memory LRU cache**: 200 entries, SHA-256(lang + sourceCode) key. ~98% hit rate under load.
  - **FIFO concurrency queue**: `COMPILER_CONCURRENCY` env (default 3, tuned to 8 for local dev = 4.5 RPS, 0% failures under 100 concurrent users).
  - **Rate limits**: Per-IP: 20 compilations/60 seconds (CF only, disabled in dev). Sourceode size cap: 50 KB.
- **Client execution**: Web Workers + WASI Preview 1 shim (from CDN). Binary cached in browser (10-entry LRU, `lang:hash` key). Warm latency ~50ms, cold ~5000ms.
- **Baseline load test** (100 users, unique code): 4.5 RPS, 13–23s latency, 0% failures with `COMPILER_CONCURRENCY=8`. Scale horizontally (K8s/load-balanced instances) only if throughput becomes bottleneck at 1000+ users.

**Scoring** — `src/lib/scoring.ts` + `src/server/leaderboard.ts`: today's POTD = speed bounty by finish order among live (ranked) ACs (too many integrity flags → base/unranked); a **past** solve = flat base score (`points.ts`); one award per (user, challenge). `todayLeaderboard()` is live/uncached; `aggregateLeaderboard('month'|'all')` uses a short-lived (~30 s) per-isolate cache of accepted submissions, shared with the profile.

## 8. Admin console — `/admin`

Gated by `isAdmin`: `getAdminUser()` on every admin page (→ redirect) and API (→ 403). Admin pages are **`force-dynamic`** so the static-assets cache can't serve them past the gate. `/admin` lists problems; `ProblemForm` (new/edit) is the full authoring UI incl. hidden tests + checker + live Markdown preview (`/api/admin/preview`). API: `POST /api/admin/problems` (409 dup), `PUT`/`DELETE /api/admin/problems/[slug]`; validated with `AdminChallengeSchema` (slug required), `content_html` rendered server-side (`toChallengeRow`). **Slug immutable on edit** (rename orphans submissions); **delete** doesn't cascade but a deleted problem's solves drop out of the aggregate boards (UI confirms). **Bootstrap admins** by hand: `UPDATE users SET is_admin = 1 WHERE username = '<name>'` (libSQL locally, or `wrangler d1 execute … --remote`).

## 9. Email — `src/server/email.ts`

`sendEmail()` uses the **Gmail API** (OAuth2 refresh-token) in prod, or logs to console in dev. Sends OTP + reset links. Needs `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`. `REQUIRE_EMAIL_VERIFICATION="true"` (in `wrangler.jsonc`) gates submitting on a verified email.

## 10. Rate limiting — `src/server/rateLimit.ts`

DB-backed fixed windows (atomic upsert on `rate_limits`), keyed per user and per IP via `enforceRateLimits([...])`. Fails **open** on DB error. Applied to login, register, forgot/resend, run, submit (exact limits live in each route).

## 11. Marketing content — team & initiatives

Static. `content/team.json` and `content/initiatives/**.md` (gray-matter frontmatter) are compiled by `scripts/build-team.mjs` / `build-initiatives.mjs` **at `next.config.ts` time** into `team.manifest.json` / `initiatives.manifest.json`, which the pages import + prerender. These manifests regenerate on every build (they show as modified in git — revert before committing). No newsroom (removed).

## 12. Commands (`package.json`)

| Command | What |
|---|---|
| `npm run dev` | Next dev (libSQL, auto-migrates) |
| `npm run build` / `npm test` / `npm run lint` | build / Vitest / ESLint |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle: new migration / apply / studio |
| `npm run challenges:seed [-- --target remote]` | Seed `challenges/*.json` → D1 (local default; remote = prod) |
| `npm run challenges:validate` | Lint challenge JSON |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | OpenNext build / local preview / deploy (each runs populateCache where needed) |
| `npm run piston:up` / `:down` / `:install` | Local judge (Docker) |

## 13. Local development

1. `npm install`
2. `npm run piston:up && npm run piston:install` (judging; Docker required)
3. `npm run dev` — migrations auto-apply to `./data/arena.db`
4. Seed problems: JSON in `challenges/`, then `npm run challenges:seed`
5. Become admin locally: register, then `UPDATE users SET is_admin=1 WHERE username='you'` in libSQL.

No Cloudflare needed for dev — `getDb()` falls back to libSQL; email/judge degrade to console/local Docker.

## 14. Deployment (Cloudflare) — READ BEFORE DEPLOYING

`npm run cf:deploy` = `opennextjs-cloudflare build` → `opennextjs-cloudflare populateCache remote` → `wrangler deploy`. Prod bindings: `DB` (D1), `ASSETS`, `REQUIRE_EMAIL_VERIFICATION`. Secrets via `wrangler secret put` (AUTH_SECRET, PISTON_URL, GMAIL_*, TURNSTILE_SECRET_KEY).

**Order for a release with a migration:**
1. **Migrate FIRST**: `npx wrangler d1 migrations apply pesuecc-arena --remote`. Because Drizzle selects every schema column, deploying code that references a new column *before* it exists = `no such column` on every affected query (e.g. a site-wide auth outage for a `users` column).
2. If a change touches challenges' rendered HTML: **re-seed** (`challenges:seed --target remote`) so `content_html` is populated — else solve pages render blank.
3. `npm run cf:deploy`.

**Auth changes are forward-only** — once users log in under new hashing code, rolling the Worker back can lock them out.

**Smoke-test every deploy** (`wrangler tail` + curl): `GET /` should be single-digit-ms CPU (caching working), and a **login with a nonexistent user must return 401, not 500** (proves password hashing works on the edge).

## 15. Critical runtime gotchas

- **PBKDF2 is capped at 100,000 iterations in prod.** The production Workers runtime throws `Pbkdf2 failed: iteration counts above 100000 are not supported`; a **local `wrangler dev` does NOT enforce this**. Keep `password.ts` `PBKDF2_ITERATIONS` ≤ 100000. This caused a full login outage once (a local probe passed while prod threw). **Generalize: never trust local `wrangler dev` for any Cloudflare runtime limit — verify on the deployed edge / `wrangler tail`.**
- **Error 1102** = the Worker exceeded its per-request **CPU or memory (128 MB)** limit. Drivers here: per-request SSR of "static" pages (fixed by the OpenNext cache), and scrypt's 16 MB scratch (why hashing moved to PBKDF2).
- **OpenNext static-assets cache** (`open-next.config.ts`: `staticAssetsIncrementalCache` + `enableCacheInterception`): prerendered pages are served from the `ASSETS` binding instead of re-SSR. **The cache is only filled by the `populateCache` step** (wired into `cf:deploy`/`cf:preview`) — a bare `wrangler deploy` would skip it and every page SSRs again. force-dynamic routes (arena, profile, `/api/*`, `/admin`) bypass the interceptor — which is exactly why **admin/auth pages must stay `force-dynamic`** (a prerendered gated page would be served from cache, skipping the gate).
- **Free plan**: `wrangler.jsonc` must NOT set `limits.cpu_ms` or `placement: smart` — the Free plan rejects them and `wrangler deploy` fails.
- **`challenges/*.json` are gitignored** (they carry hidden tests). A fresh checkout won't have them; they live only in local copies and in D1.
- **Manifest churn**: `team.manifest.json` / `initiatives.manifest.json` regenerate on build — revert before committing.

## 16. Environment variables & secrets

- `AUTH_SECRET` — HMAC key for session tokens (required in prod).
- `REQUIRE_EMAIL_VERIFICATION` — `"true"` gates submit on a verified email (in `wrangler.jsonc`).
- `PISTON_URL` — judge endpoint (default `http://localhost:2000`); prod points to an external Piston.
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` — Gmail API.
- `TURNSTILE_SECRET_KEY` (+ `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) — optional bot check; no-op if unset.
- `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN`) — libSQL, dev only.
- Runtime bindings (not env vars): `DB` (D1), `ASSETS`.

## 17. Conventions

- **API routes**: `export const dynamic = "force-dynamic"`; parse JSON defensively; respond `{ ok, error?, ... }`; gate with `getCurrentUser()`/`getAdminUser()` (401/403). CSRF posture = sameSite=lax cookies + same-origin fetch (no token scheme).
- **Validation**: one shared zod schema (`src/lib/challenge-schema.ts`) for the seed script AND the admin API.
- **Markdown**: rendered + sanitized (`rehype-sanitize`) once at seed/save time into `content_html`. Don't add a client Markdown renderer to the request path.
- **Tests** (`*.test.ts`, colocated): pure logic (scoring, points, challenges, password, token, rate limit). `npm test`.
- **CI** (`.github/workflows/ci.yml`): typecheck, lint, test, build, challenge validation on Node 22.

## 18. Other docs in the repo

`README.md` (overview/setup), `DEPLOY.md` (Cloudflare + secrets), `CONTRIBUTING.md` (dev + PR + problem authoring), `docs/backend.md` (local stack), `challenges/README.md` (problem JSON schema), `DESIGN.md` / `VISION.md` (brand/UX), `SECURITY.md`, `CODE_OF_CONDUCT.md`.
