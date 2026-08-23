# CP Arena — local backend

Local dev runs the **Next.js app and its SQLite database natively on Node**. The
judge execution sandbox is our high-performance **Rust Judge Sandbox**.

## Stack

| Piece | Where | Notes |
| --- | --- | --- |
| Web app + API routes | Node (`npm run dev`) | App Router route handlers under `src/app/api` |
| Database | SQLite via libSQL + Drizzle | file at `./data/arena.db` (git-ignored) |
| Judge | Rust Sandbox in Docker | `docker-compose.yml`, reached at `JUDGE_URL` (port 8080) |

Problems live in the database too — the `challenges` table (`src/server/db/schema.ts`),
read by `src/lib/challenges.ts`. Statements are Markdown, rendered to sanitized HTML
server-side. Seed the example problem locally with `npm run challenges:seed`.

## First run

```bash
# 1. Start the judge sandbox (Docker)
npm run judge:up

# 2. Run the app (migrations auto-apply on startup)
npm run dev

# 3. Seed the example problem into the DB (publishes it; re-run after edits)
npm run challenges:seed

# 4. Verify the whole stack
curl localhost:3000/api/health
# => { "ok": true, "db": true, "judge": true, "workers": 2, ... }
```

No `.env` is required — the code defaults to `file:./data/arena.db` and
`http://localhost:8080`. Copy `.env.example` to `.env.local` to override.

## Database

Migrations live in `./migrations` and are applied automatically on server start
(`src/instrumentation.ts` ? `runMigrations`). Manual control:

```bash
npm run db:generate   # after editing src/server/db/schema.ts
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the DB
```

## Judge Sandbox

```bash
npm run judge:up       # docker compose up -d
npm run judge:down     # stop
```

The Rust Judge Sandbox runs privileged (for cgroups v2, pivot_root, and seccomp isolation)
and is published on `127.0.0.1:8080`.