# CP Arena — local backend

Local dev runs the **Next.js app and its SQLite database natively on Node**. The
only containerised piece is the **Piston** code-execution sandbox.

## Stack

| Piece | Where | Notes |
| --- | --- | --- |
| Web app + API routes | Node (`npm run dev`) | App Router route handlers under `src/app/api` |
| Database | SQLite via libSQL + Drizzle | file at `./data/arena.db` (git-ignored) |
| Judge | Piston in Docker | `docker-compose.yml`, reached at `PISTON_URL` |

Challenges stay as GitOps markdown (`src/lib/challenges.ts`); the DB
(`src/server/db/schema.ts`) holds users and submissions.

## First run

```bash
# 1. Start the judge (Docker)
npm run piston:up

# 2. Install language runtimes into Piston (one-time; persisted on a volume)
npm run piston:install        # c++, python, java

# 3. Run the app (migrations auto-apply on startup)
npm run dev

# 4. Verify the whole stack
curl localhost:3000/api/health
# => { "ok": true, "db": true, "piston": true, "runtimes": ["c++@10.2.0", ...] }
```

No `.env` is required — the code defaults to `file:./data/arena.db` and
`http://localhost:2000`. Copy `.env.example` to `.env.local` to override.

## Database

Migrations live in `./migrations` and are applied automatically on server start
(`src/instrumentation.ts` → `runMigrations`). Manual control:

```bash
npm run db:generate   # after editing src/server/db/schema.ts
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the DB
```

## Judge

```bash
npm run piston:up       # docker compose up -d
npm run piston:down     # stop
```

Piston runs privileged (sandbox isolation) and is published on
`127.0.0.1:2000`. Language runtimes install via its package API — see
`scripts/install-runtimes.sh`.

## Next

- `POST /api/submit` — run a submission in Piston against hidden tests, record
  the server-authoritative verdict/time/flags, update standings.
- `GET /api/leaderboard` — real standings from the DB.
- A minimal dev login so submissions belong to a user.
