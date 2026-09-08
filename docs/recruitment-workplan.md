# Recruitment build — two-dev work split

Companion to [`recruitment.md`](./recruitment.md), which is the spec. This document is the
*execution* plan: who does what, in what order, and how to avoid stepping on each other.

**Scope:** `/join` (public page with an embedded Google Form) + `/admin/recruitment` (open/close the
drive and change the form link without a deploy).

**Sizing:** ~2–3 developer-days total. One dev can do it; two is for slack, not necessity. Three
would collide on the same files and slow you down.

---

## The shape: 3 PRs, and A and B never touch the same file

```
                    ┌─────────────────────┐
                    │  PR 0 — foundation  │   ~1 hour, either dev
                    │  schema · migration │   MERGE THIS FIRST
                    │  lib · server       │
                    └──────────┬──────────┘
                               │ merged to main
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
    ┌────────────────────────┐   ┌────────────────────────┐
    │  PR A — admin console  │   │  PR B — public /join   │
    │  Dev A                 │   │  Dev B                 │
    └────────────────────────┘   └────────────────────────┘
                 └─────────────┬─────────────┘
                               ▼
                    merge in any order → deploy
```

PR 0 exists so the two parallel PRs share **zero** files. Without it, both devs need
`src/server/recruitment.ts` and you get a conflict on day one.

---

## PR 0 — Foundation (do this first, together, ~1 hour)

Whoever is free. Small enough to review in five minutes. **Merge to `main` before A and B branch.**

| File | What |
|---|---|
| `src/server/db/schema.ts` | Add the `recruitmentSettings` table + inferred types |
| `migrations/00xx_*.sql` | `npm run db:generate` — commit the SQL **and** the `migrations/meta` snapshot |
| `src/lib/recruitment.ts` | `isGoogleFormUrl()`, `toEmbedUrl()`, `toShareUrl()` |
| `src/lib/recruitment.test.ts` | Tests for the above — it guards an iframe `src`, so it's worth testing |
| `src/server/recruitment.ts` | `getRecruitmentSettings()`, `updateRecruitmentSettings()` |

**Done when:** `npm run test` passes, `npx tsc --noEmit` is clean, and `getRecruitmentSettings()`
returns the safe default (`isOpen: false, formUrl: null`) against a database with no settings row.

---

## PR A — Admin console

**Branch:** `feat/recruitment-admin`

| Step | File | Notes |
|---|---|---|
| 1 | `src/app/api/admin/recruitment/route.ts` | `PATCH`. Copy the shape of `src/app/api/admin/teachers/route.ts` |
| 2 | `src/app/admin/layout.tsx` | **New.** Lift the shared admin nav here |
| 3 | `src/app/admin/page.tsx`, `src/app/admin/users/page.tsx` | Delete the now-duplicated `<nav>` blocks |
| 4 | `src/app/admin/recruitment/page.tsx` | Server component. Mirror `src/app/admin/users/page.tsx` |
| 5 | `src/components/admin/RecruitmentPanel.tsx` | Client. Mirror `src/components/admin/UserManagementPanel.tsx` |

### Watch out for

- **The layout is presentational only.** Keep `getAdminUser()` + `redirect("/")` **and**
  `export const dynamic = "force-dynamic"` in every page, exactly as today. The comment at
  `src/app/admin/page.tsx:14` explains why: without `force-dynamic` the static-asset cache
  interceptor can serve the page without ever running the gate. Do not make the layout the security
  boundary.
- **Gate the route handler too**, not just the page. A route handler is reachable by direct POST no
  matter what the UI shows.
- The layout also gives the nav to `admin/problems/new` and `admin/problems/[slug]/edit`, which
  currently have none, and to `admin/teachers`, which was accidentally missing it. That's the fix,
  but it is a visible change to three pages — mention it in the PR description so review isn't
  surprised.

### Done when

- `/admin/recruitment` redirects to `/` when signed out and when signed in as a non-admin.
- `curl -X PATCH localhost:3000/api/admin/recruitment` with no session returns **403**.
- Saving `https://example.com/x` shows an inline error and writes nothing.
- Saving a real Google Form URL persists across a reload.
- All five admin pages show the same nav.

---

## PR B — Public `/join` page

**Branch:** `feat/recruitment-join-page`

| Step | File | Notes |
|---|---|---|
| 1 | `next.config.ts:30` | Add `https://docs.google.com` to `frame-src`. **One token, nothing else** |
| 2 | `src/components/join/GoogleFormEmbed.tsx` | Server component — an iframe needs no client JS |
| 3 | `src/app/join/page.tsx` | Server component, `force-dynamic` (it reads the settings row) |
| 4 | `src/components/Navbar.tsx:10` | Add `{ href: "/join", label: "Join" }` |
| 5 | `src/components/Footer.tsx:5` | Same, in the `explore` array |
| 6 | `src/app/page.tsx` (~L245) | Add the missing "Apply now →" CTA under "What you get as a member" |

### Watch out for

- **Do the CSP step second, not first.** Build the page, see the blank frame and
  `Refused to frame 'https://docs.google.com/'` in the console, *then* add the token and watch it
  load. Otherwise you've never proven which change fixed it.
- **Leave `X-Frame-Options` and `frame-ancestors` alone.** They control who may frame *our* pages —
  they have nothing to do with what we may frame. Weakening them is a security regression for no gain.
- **No `sandbox` attribute** on the iframe — Google Forms needs scripts and same-origin for itself.
- `Link` comes from `@/components/AppLink`, **never** `next/link`. Read that file's header comment
  before you argue with it: Next 16 prefetch loops on the Cloudflare edge and once burned ~285k
  requests in 6 hours.
- The frame **cannot** auto-size to its content. That's cross-origin, there is no workaround, don't
  spend an afternoon on it. `min-h-[75vh] sm:min-h-[1200px]` and move on.

### Done when

- Form renders and a real test submission lands in the linked Sheet.
- Dark mode: the white form reads as a deliberate white card, not a broken patch.
- 375px wide: no horizontal page scroll, form usable.
- `isOpen: false` **and** `formUrl: null` both render the closed state without crashing.
- The "open in a new tab" fallback link works.

---

## Local setup (both devs, once)

```bash
npm install
npx tsx scripts/create-admin.ts     # local admin — username: admin
npm run dev                         # migrations auto-apply via src/instrumentation.ts
```

`scripts/create-admin.ts` has a hardcoded password in the repo. Fine locally; **never run it against
production.**

**Dev B: you don't need the real recruitment form to start.** Create a throwaway Google Form with
two questions, paste its URL into `/admin/recruitment`, and build against that. Swap in the real one
(from **@barunaniket**) at the end — that swap is a paste into the admin console, not a code change,
which is the whole point of the admin screen.

---

## House conventions — both of you

The codebase is consistent. Match it rather than importing habits from elsewhere.

- **No form library.** `useState` per field + `onSubmit` + `fetch`. There is no react-hook-form, no
  toast library, no shadcn/ui. Errors are an inline red `<p>`.
- **`{ ok, error }` JSON envelope** on every API response. Clients branch on `data.ok`.
- **`getDb()` inside the function**, never at module scope — Worker isolates don't share state.
- **`export const dynamic = "force-dynamic"`** on anything that reads the session or the DB.
- Styling: `.mecha-input`, `.mecha-btn mecha-btn--solid`, `MechaPanel`, `Reveal`. Tokens
  (`text-chocolate`, `text-bronze`, `border-hairline`) live in `globals.css`.
- **Read `node_modules/next/dist/docs/` before writing Next-specific code.** This is Next 16 — for
  example `middleware.ts` is now `proxy.ts`. `AGENTS.md` requires this.
- If `next dev` re-adds the block to `AGENTS.md` / `CLAUDE.md`, **commit it**. Dropping it from the
  diff only recreates the uncommitted change.

**CI runs on every PR:** `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm run test` →
`npm run build`. Run the typecheck locally — it's the one people forget and it fails builds.

---

## Schedule (Tue → Fri)

| Day | Dev A | Dev B | Core team (not devs) |
|---|---|---|---|
| **Tue** | PR 0 → merge. Start API route | Local setup, throwaway form | **Get form URL from @barunaniket** |
| **Wed** | Layout extraction + admin page | `GoogleFormEmbed` + `/join` skeleton | Settle domains, eligibility |
| **Thu** | `RecruitmentPanel`, PR A up | Copy, dark mode, mobile, PR B up | Review copy |
| **Fri** | Review B | Review A | Merge → deploy → test live |

---

## What actually blocks you (none of it is code)

1. **The Google Form URL.** Ask **@barunaniket** for it — see the note in `recruitment.md`. `/join`
   has nothing to embed without it, and the domains listed on the page must match the form's
   options, so get it in hand early rather than the day you need it.
2. **Two open decisions** — which years may apply, and what happens after submitting. Coordinator
   call, not a dev call.
3. **Production admin access.** After merge someone must run
   `npx wrangler d1 migrations apply pesuecc-arena --remote` *and* sign into prod `/admin` to paste
   the form URL. **Verify today that someone can actually log into production as an admin.**
   `isAdmin` is bootstrapped out-of-band — finding out on Friday that nobody can is exactly how a
   launch day disappears.

---

## Deploy checklist

1. Merge PR A and PR B (either order).
2. `npx wrangler d1 migrations apply pesuecc-arena --remote`
3. `npm run cf:deploy`
4. Sign into production `/admin/recruitment`, paste the real form URL, set the cycle label, toggle
   **Open**.
5. Load `/join` on a phone. Submit one real response. Confirm it lands in the Sheet.

The settings row does **not** travel with the code — step 4 is a manual production step, every time.

---

## Risk

The `/join` page copy and design is the only thing likely to overrun; everything else follows an
existing pattern. If Thursday gets tight, ship `/join` with plainer copy and refine it after the
drive opens. The form works either way — the page is a wrapper around it, not the product.
