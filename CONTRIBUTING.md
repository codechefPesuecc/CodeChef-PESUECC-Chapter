# Contributing to the CodeChef PESUECC Chapter Platform

First off — **thank you**. This platform is built and maintained by students, for students, and it
only gets better because people like you show up. Whether you are fixing a typo, adding a problem,
writing an editorial, or shipping a whole feature, you belong here.

This guide is intentionally detailed so that a **first-time contributor with zero prior context** can
get from "I just cloned the repo" to "my PR is merged" without getting stuck. If anything here is
unclear or out of date, that itself is a great first contribution — open a PR to fix it.

New to the project? Please also read [`VISION.md`](./VISION.md) (where we are taking this) and
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) (how we treat each other). By contributing, you agree to
abide by the Code of Conduct.

---

## Table of Contents

1. [Ways to contribute](#1-ways-to-contribute)
2. [Getting your environment set up](#2-getting-your-environment-set-up)
3. [The golden rule about `package-lock.json`](#3-the-golden-rule-about-package-lockjson)
4. [Project structure](#4-project-structure)
5. [Branching and commit conventions](#5-branching-and-commit-conventions)
6. [The pull request process](#6-the-pull-request-process)
7. [What CI checks](#7-what-ci-checks)
8. [Code style](#8-code-style)
9. [Adding a problem](#9-adding-a-problem)
10. [Database migrations](#10-database-migrations)
11. [Secrets and environment](#11-secrets-and-environment)
12. [Reporting bugs](#12-reporting-bugs)
13. [Reporting a vulnerability](#13-reporting-a-vulnerability)
14. [Getting help](#14-getting-help)

---

## 1. Ways to contribute

You do **not** need to be a competitive programming god or a Next.js expert to help. Valuable
contributions include:

- **Code** — features, bug fixes, refactors, tests, accessibility and performance improvements.
- **Problems** — author challenges for the arena and seed them into the database (see section 9).
- **Editorials** — write up clean explanations of past problems so juniors can learn from them.
- **Design / UX** — improve layouts, responsiveness, and adherence to the brand system.
- **Docs** — improve this guide, the README, or in-code comments.
- **Bug reports & ideas** — a well-written issue is a real contribution (see section 12).

If you are looking for a place to start, check the
[issues](https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter/issues), especially anything
labelled `good first issue`.

---

## 2. Getting your environment set up

### Prerequisites

- **Node.js 22.x** — *use the same major version as CI*. This matters more than it looks; see
  [section 3](#3-the-golden-rule-about-package-lockjson). If you use `nvm`:
  ```bash
  nvm install 22
  nvm use 22
  ```
- **Git**.
- (Optional, only for the code judge) **Docker**, to run the Piston sandbox locally — see
  `docs/backend.md`.

### First-time setup

```bash
# 1. Clone
git clone https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter.git
cd CodeChef-PESUECC-Chapter

# 2. Install dependencies EXACTLY as locked (see section 3 for why 'ci', not 'install')
npm ci

# 3. Run the app. No database setup needed — dev uses a local SQLite file
#    (./data/arena.db) and auto-applies the migrations in /migrations on startup.
npm run dev
```

Open <http://localhost:3000>. That's it — you have a working local instance.

The **Run / Submit** buttons need the Piston judge running. If you are not working on the judge, you
can ignore the 503s from those endpoints; everything else works without it. To run the judge locally,
see `docs/backend.md`.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (local SQLite, hot reload) |
| `npm run build` | Production Next.js build |
| `npm run lint` | ESLint |
| `npm run test` | Run the test suite (Vitest) |
| `npm run challenges:validate` | Validate every problem JSON in `/challenges` |
| `npm run cf:preview` | Build with the OpenNext adapter and run under Wrangler locally |

Before opening a PR, the fastest way to be confident CI will pass is to run what CI runs (section 7).

---

## 3. The golden rule about `package-lock.json`

**Do not commit changes to `package-lock.json` unless you deliberately added or removed a dependency
in `package.json`.**

This has bitten us before and it is worth understanding *why*, because it is easy to trip over:

- Some of our build tools (e.g. `rolldown`, used by Vitest) ship a **separate native binary per
  operating system**, listed in the lockfile as *optional dependencies*.
- When you run `npm install` on your machine, some npm versions (notably the npm bundled with
  **Node 24**) **prune the lockfile down to only your platform's binary**, deleting the entries for
  Windows / macOS / Linux that you are not on.
- Our CI runs on **Linux**. It uses `npm ci`, which installs *exactly* what the lockfile says. If your
  regenerated lockfile deleted the Linux binary, CI can no longer find it, and the test step crashes
  at startup with a confusing "Cannot find native binding" error — on code that is perfectly fine.

**How to stay safe:**

- Use **`npm ci`** (not `npm install`) to install dependencies. `npm ci` installs from the lockfile
  and never rewrites it.
- Use **Node 22** locally, matching CI.
- Only regenerate the lockfile on purpose, when changing dependencies. If you open a PR and see
  thousands of lockfile lines changed but you never touched `package.json`, that is this bug. Undo it:
  ```bash
  git checkout origin/main -- package-lock.json
  git commit -m "chore: restore package-lock.json"
  ```

If CI's `verify` job goes red and the log mentions a native binding or optional dependency, this is
almost always the cause.

---

## 4. Project structure

```text
├── .github/workflows/   # CI: typecheck, lint, test, build
├── src/
│   ├── app/             # Next.js App Router (pages + edge API routes)
│   │   ├── api/         # Edge backends (/api/submit, /api/leaderboard, /api/auth/*, ...)
│   │   ├── cp-arena/    # The arena: problem listing, solve view, live standings
│   │   ├── newsroom/    # Announcements, event recaps, contest results
│   │   ├── initiatives/ # Events & engineered-systems portfolio
│   │   └── team/        # Core & alumni registry
│   ├── components/      # Reusable UI (CodeChef brand system)
│   ├── server/          # Server-only logic: auth, db, rate limiting, leaderboard, email
│   └── lib/             # Shared helpers, challenge loading, events data
├── challenges/          # Problem authoring source (JSON) — seeded into D1, not committed
├── migrations/          # Cloudflare D1 (SQLite) migrations
├── scripts/             # Build/validate scripts (challenges, team, etc.)
└── wrangler.jsonc       # Cloudflare Workers & D1 binding configuration
```

A few things worth internalizing:

- **We run on Cloudflare Workers, and Workers have no filesystem.** Anything that would normally be
  read from disk at runtime (problems, the team roster) is **bundled at build time** into a manifest.
  That is why problems are JSON files compiled into the app, and why "publishing a problem is a
  redeploy."
- **Read env/secrets inside the request handler, not at module top level.** On Workers, bindings and
  secrets are only reliably available within request scope. Reading them at module load has caused
  real bugs here.
- The `AGENTS.md` note is real: this Next.js version has breaking changes from what you may remember.
  When in doubt, check the guides under `node_modules/next/dist/docs/`.

---

## 5. Branching and commit conventions

### Branches

Never commit directly to `main`. Create a descriptive branch, prefixed by type:

- `feat/<short-description>` — a new feature
- `fix/<short-description>` — a bug fix
- `chore/<short-description>` — tooling, deps, config, refactors
- `docs/<short-description>` — documentation only

Example: `feat/contest-live-scoreboard`, `fix/leaderboard-timezone`.

### Commit messages

We follow **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
<type>(<optional scope>): <short summary in the imperative>

<optional body explaining what and why, not how>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`.

Good examples:

```
feat(arena): add live scoreboard freeze in the last 30 minutes
fix(auth): read REQUIRE_EMAIL_VERIFICATION per-request, not at module load
docs(contributing): explain the package-lock.json / native binding gotcha
```

Keep commits focused. A PR that says `fix: stuff` with 40 unrelated changes is very hard to review.

---

## 6. The pull request process

1. **Fork or branch** from an up-to-date `main`.
2. Make your change in a focused branch.
3. **Run the checks locally** (section 7) so CI is green on the first try.
4. Push and **open a pull request against `main`.** Fill in the description:
   - *What* changed and *why*.
   - *How to test it* (steps or screenshots for UI changes).
   - *Linked issues* — write `Closes #NN` to auto-close the issue on merge.
5. **CI must pass.** A red PR will not be reviewed until it is green.
6. **At least one core-team review/approval** is required before merge. Respond to review comments;
   push follow-up commits (don't force-push mid-review unless asked — it makes re-reviewing harder).
7. A core-team member merges. Keep the PR **scoped**: several small PRs beat one giant one.

**Keep PRs single-purpose.** If you find yourself changing dependencies, refactoring, *and* adding a
feature in one branch, split it. In particular, an unrelated `package-lock.json` diff should never
ride along in a feature PR (section 3).

---

## 7. What CI checks

Every push and pull request runs the `CI` workflow (`.github/workflows/ci.yml`) on **Node 22 /
Ubuntu**, in this order — a failure at any step fails the build:

1. **Install** — `npm ci`
2. **Typecheck** — `npx tsc --noEmit`
3. **Lint** — `npm run lint`
4. **Test** — `npm run test`
5. **Build** — `npm run build`

A separate workflow validates every challenge JSON (`npm run challenges:validate`).

To reproduce the whole thing locally before pushing:

```bash
npm ci && npx tsc --noEmit && npm run lint && npm run test && npm run build
```

If that passes on Node 22, your PR's `verify` job will almost certainly pass too.

---

## 8. Code style

- **TypeScript everywhere.** Prefer explicit, well-named types; avoid `any` unless truly unavoidable.
- **Formatting/linting is enforced by ESLint.** Run `npm run lint` before pushing. Match the style of
  the surrounding code — indentation, naming, and idioms.
- **Styling is Tailwind CSS**, using the brand palette. Do not hardcode off-brand colors; use the
  established tokens:
  - Background cream `#F5F1EB`, structural brown `#5B4638`, chocolate `#3E2F24`,
    bronze (CTAs) `#A67C52`, charcoal body `#1F1F1F`, white panels `#FFFFFF`.
  - See `DESIGN.md` and `README.md` for the full brand system.
- **Accessibility matters.** Interactive controls must be keyboard-operable and have accessible
  labels. Do not ship a `div` with an `onClick` and no keyboard handler.
- **Keep server-only code in `src/server/`** and never import it into client components. Never leak
  secrets, hidden test cases, or internal error strings to the client.
- **Write a test** for non-trivial server logic where you reasonably can (see existing `*.test.ts`).

---

## 9. Adding a problem

Problems live in the database. You author each one as **one JSON file**, validate it, and load it into
D1 with the seed script — publishing is a database write, not a redeploy. (An in-browser admin
dashboard is planned; until then, the seed script is the publish path.)

1. Create `challenges/YYYY-MM-DD-slug.json` following the shape documented in `challenges/README.md`.
   In brief: title, difficulty, date, tags, limits, statement, I/O format, constraints, checker,
   `samples` (shown to solvers), and `tests` (the hidden judged cases).
2. **`tests` are server-side only** — never sent to the browser, and never committed: the authoring
   JSON is git-ignored so hidden tests stay out of the repo.
3. Validate: `npm run challenges:validate`.
4. Seed it: `npm run challenges:seed` (local dev DB) or `npm run challenges:seed -- --target remote`
   (production D1). It releases automatically once its `date` (IST) is on or before today — the
   Problem of the Day is the most recent released problem.

When authoring: write clear statements, include tricky edge cases in the hidden tests (empty input,
maximum constraints, ties), and make sure the sample matches the stated I/O format exactly.

---

## 10. Database migrations

We use Drizzle ORM over Cloudflare D1 (SQLite). Schema lives in `src/server/db/schema.ts`; migrations
live in `/migrations`.

- When you change the schema, **generate a migration file** (`npm run db:generate`) and **commit it**
  with your PR. Migrations are code and must be reviewed.
- **Do not apply migrations to the remote/production database yourself.** Applying to remote D1 is a
  core-team action, done deliberately and coordinated with a deploy. Write the migration; let it be
  reviewed and applied through the proper channel.
- Local `npm run dev` auto-applies migrations to your local SQLite file, so you can test them
  immediately.
- Migrations should be **additive and backward-compatible** where possible (add columns with
  defaults) so a deploy never breaks a running instance.

---

## 11. Secrets and environment

- **Never commit secrets** — API keys, tokens, OAuth client secrets, passwords — to the repo, not in
  code, not in a committed `.env`, not in a PR description, not in an issue.
- Production secrets are stored as **Cloudflare Worker secrets** (via `wrangler secret put`) and are
  never checked in. See `DEPLOY.md`.
- If you ever commit a secret by accident, **assume it is compromised**: rotate it immediately and
  tell the core team. Removing it in a later commit is not enough — it is in the git history.
- For local development, use a local `.env` that is git-ignored. Ask the core team if you need values
  to test something specific.

---

## 12. Reporting bugs

A good bug report is genuinely valuable. Open an
[issue](https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter/issues) and include:

- **What you expected** vs **what actually happened**.
- **Steps to reproduce** — as precise as you can.
- **Environment** — browser/OS, and whether it was local or on the live site.
- **Evidence** — screenshots, the exact error message, console/network output.
- For CI failures, a link to the failing run and the relevant log lines.

Search existing issues first to avoid duplicates. If you find an existing one, add your details there
instead of opening a new one.

---

## 13. Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities**, and do not exploit them against
the live platform beyond the minimum needed to confirm the problem.

Instead, report it privately to the core team at **`codechef.ecc@pes.edu`** with:

- A description of the vulnerability and its potential impact.
- Clear steps to reproduce (a proof of concept is ideal).
- Any suggested remediation, if you have one.

Responsible disclosure is welcomed and appreciated. Attempting to break the sandbox, leak hidden test
cases, or manipulate the leaderboard for advantage is **not** the same thing — that is a Code of
Conduct violation (see `CODE_OF_CONDUCT.md` -> *Academic & Competitive Integrity*). Reporting a flaw
in good faith so we can fix it is exactly what we want.

---

## 14. Getting help

Stuck? That is normal and welcome.

- Comment on the relevant issue or pull request.
- Ask in the chapter's channels (Discord / WhatsApp).
- Email the core team at **`codechef.ecc@pes.edu`**.

There are no stupid questions here. Welcome aboard, and thank you for making the chapter better. 🌾

---

*Maintained by the CodeChef PESUECC Chapter core team. Last reviewed: August 2026.*
