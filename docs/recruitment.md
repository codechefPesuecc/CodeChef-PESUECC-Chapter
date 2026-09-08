# `/join` — Recruitment page with embedded Google Form, managed from the admin console

## Context

Club recruitments for this year are opening, and applicants need a way in from the website.
Applications themselves will be **handled entirely in Google Forms** — a deliberate choice: a live
recruitment drive is a bad first customer for brand-new code, and the core team must be able to edit
questions and triage responses in Sheets without a developer.

What the site is missing is the front door. There is **no recruitment surface of any kind** today —
zero hits for recruit/apply/shortlist across every branch and all 100 GitHub issues. The homepage has
a "What you get as a member" section (`src/app/page.tsx:218`) with **no call to action attached to
it**, and neither the navbar nor the footer has a join link.

This plan builds two things:

1. **`/join`** — a designed public page with the club pitch, domains, timeline, and the Google Form
   **embedded inline** so applicants stay on the site.
2. **`/admin/recruitment`** — an admin console screen to **open/close recruitment and change the form
   link without a code change or a deploy**. This is what makes the page reusable every year: next
   year's committee pastes a new form URL and flips a switch.

Because the form URL is admin-editable, it lives in the **database**, not a constant — so `/join`
reads it per request.

> Longer term this contradicts `VISION.md:28` ("those should live on the platform, not scattered
> across a WhatsApp group and a Google Form"). Accepted for this cycle — see Follow-up.

---

## Prerequisite — before the page is useful 
# Note : Before handling the form, make sure you ask @barunaniket for the google form iframe. 

1. **Create the Google Form** for recruitment.
2. **Add a question: "Your CodeChef PESUECC Arena username"**, with help text pointing at
   `/register`. This is the one field that matters structurally — it's the only bridge between a form
   response and a real account. `users.srn` / `users.prn` are both `UNIQUE` and emails are
   OTP-verified, so a username lets you join responses back to verified accounts later instead of
   fuzzy-matching SRN strings by hand.
3. **Paste the form URL into `/admin/recruitment`** once deployed (Send → `<>` → copy the
   `https://docs.google.com/forms/d/e/…/viewform` URL). No code change needed.

---

## The work

### 1. Database — `src/server/db/schema.ts`

One settings row. Follows the file's existing conventions: `text` id, epoch-ms integer timestamps,
boolean via `integer({ mode: "boolean" })`, YYYY-MM-DD dates as `text` (same as `challenges.date`).

```ts
// Recruitment drive settings — a single row (id = "current"), edited from
// /admin/recruitment so a new cycle needs a form URL paste, not a deploy.
export const recruitmentSettings = sqliteTable("recruitment_settings", {
  id: text("id").primaryKey(),                // always SETTINGS_ID
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(false),
  // Google Forms URL. NULL until an admin configures it — /join then shows the
  // closed state rather than an empty frame.
  formUrl: text("form_url"),
  cycle: text("cycle"),                       // e.g. "2026–27", shown in the hero
  closesOn: text("closes_on"),                // YYYY-MM-DD, display only
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
});
```

Plus the `RecruitmentSettings` / `NewRecruitmentSettings` `$inferSelect` types at the bottom, matching
the file's pattern.

Migration: `npm run db:generate`, commit the generated SQL **and** the `migrations/meta` snapshot.
Applied automatically in Node dev by `src/instrumentation.ts`; in production run
`npx wrangler d1 migrations apply pesuecc-arena --remote`. **Don't skip that last step** — it's the
one people forget, and the page will 500 in prod without it.

No seed insert. The helper below returns defaults when the row is missing, and saving upserts it.

### 2. `src/lib/recruitment.ts` (new) + `recruitment.test.ts`

Pure URL logic, in `src/lib/` alongside the other isomorphic modules that carry colocated vitest
files:

- `isGoogleFormUrl(url)` — must parse, be `https:`, host exactly `docs.google.com`, path starting
  `/forms/`. Rejects everything else including `javascript:`.
- `toEmbedUrl(url)` — appends `embedded=true`; `toShareUrl(url)` strips it (for the fallback link).
  Admins paste whichever URL Google gave them and both forms work.

Worth testing since it guards what goes into an iframe `src`.

### 3. `src/server/recruitment.ts` (new)

Mirrors `src/server/profile.ts` — a discriminated result rather than throwing, which is the
established convention (`updateProfile`, `deleteUser`).

- `getRecruitmentSettings()` → the row, or a safe default (`isOpen: false, formUrl: null`) if absent.
- `updateRecruitmentSettings(adminId, input)` → `{ ok: true } | { ok: false; error; status }`.
  Validates `formUrl` with `isGoogleFormUrl` (400 with a clear message), trims `cycle`, checks
  `closesOn` looks like `YYYY-MM-DD`, then upserts with `updatedAt`/`updatedBy`.

Always call `getDb()` **inside** the function, never at module scope — Worker isolates.

### 4. `PATCH /api/admin/recruitment` — `src/app/api/admin/recruitment/route.ts` (new)

The canonical handler shape used across `src/app/api/admin/**`:

```ts
export const dynamic = "force-dynamic";
// getAdminUser() → 403 "Admins only." → enforceRateLimits → parse JSON (catch → 400)
// → updateRecruitmentSettings → NextResponse.json({ ok: true })
```

The auth check goes **in the route**, not only on the page — a route handler is reachable by direct
POST regardless of what the UI shows.

### 5. `src/app/admin/layout.tsx` (new) — extract the admin nav

The admin nav is currently **copy-pasted** into `admin/page.tsx` and `admin/users/page.tsx`, and
**missing entirely** from `admin/teachers/page.tsx`. Adding a fourth tab by hand would make that
worse, so lift the nav into a layout and delete the two copies.

Two things to be deliberate about:

- **The layout is presentational only.** Keep the `const admin = await getAdminUser(); if (!admin)
  redirect("/")` gate and `export const dynamic = "force-dynamic"` in **every** page, exactly as
  today. The comment at `src/app/admin/page.tsx:14` explains why that's load-bearing: without
  `force-dynamic` the static-assets cache interceptor can serve the page without running the gate.
  Don't turn the layout into the security boundary.
- It also gives the nav to `admin/problems/new` and `admin/problems/[slug]/edit`, which currently
  have none. That's an improvement, but it's a visible change to those pages — expect it.

Nav becomes: CP Arena · Teachers · Users · **Recruitment**.

### 6. `/admin/recruitment` — page + panel

- `src/app/admin/recruitment/page.tsx` — server component, admin gate + `force-dynamic`, reads
  `getRecruitmentSettings()`, renders the panel. Same shell as `src/app/admin/users/page.tsx`.
- `src/components/admin/RecruitmentPanel.tsx` — `"use client"`, modelled on
  `src/components/admin/UserManagementPanel.tsx`.

Fields: **Open for applications** (checkbox/toggle), **Google Form URL** (the important one),
**Cycle label**, **Closes on**. One Save button → `PATCH /api/admin/recruitment` → on `!data.ok` show
`data.error` in an inline red `<p>`; on success `router.refresh()`.

Follow the house conventions exactly — no form library, `useState` per field + `onSubmit` + `fetch`,
`{ ok, error }` envelope, `.mecha-input` and `.mecha-btn mecha-btn--solid`, no toast library (none
exists).

Two touches worth having:
- A **live preview link** to the saved form URL (new tab) so an admin can confirm they pasted the
  right form before opening recruitment.
- A line showing the current state in plain words — *"Recruitment is open. /join is showing the
  form."* — so nobody has to guess what the toggle did.

### 7. `next.config.ts:30` — the one-line CSP change

The current policy blocks the embed silently (blank box, no visible error):

```
"frame-src 'self' https://challenges.cloudflare.com",
```

Add exactly one token:

```
"frame-src 'self' https://challenges.cloudflare.com https://docs.google.com",
```

**Change nothing else.** Leave `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `form-action
'self'` and `connect-src` alone:

- `X-Frame-Options` and `frame-ancestors` govern *who may frame our pages* — they have no bearing on
  what we may frame. Weakening them would be a pure security regression for no benefit.
- `form-action 'self'` is irrelevant here: the iframe's document runs under **Google's** CSP, not
  ours. Our policy only governs the frame URL itself.

Useful side effect now that the URL is admin-editable: CSP pins the frame to `docs.google.com`, so
even a mistyped or malicious URL that slipped past `isGoogleFormUrl` still cannot frame anything else.
Defense in depth, and a reason not to loosen this token later.

### 8. `src/components/join/GoogleFormEmbed.tsx` (new)

A **server component** — an `<iframe>` needs no client JS, so no `"use client"`. Takes the URL as a
prop.

- `src={toEmbedUrl(formUrl)}`, `title="Club recruitment application form"` (required for screen
  readers — the frame is otherwise unlabelled).
- **No `sandbox` attribute** — Google Forms needs scripts and same-origin for itself; sandboxing
  breaks it.
- No `loading="lazy"` — this is the page's primary content, not below-the-fold.
- **Height:** `min-h-[75vh] sm:min-h-[1200px]`, full width. Viewport-relative on mobile so it fills
  the screen and the user scrolls inside the form naturally; tall on desktop so the inner scrollbar
  rarely appears. The frame **cannot** auto-size to its content — a cross-origin limitation with no
  workaround, so some inner scrolling is unavoidable.
- **Wrap in a white, rounded, padded container** (`bg-white rounded-2xl border border-hairline`) so
  the always-white Google form reads as an intentional card in dark mode rather than a broken render.
- Directly beneath, always visible: *"Trouble loading the form? Open it in a new tab ↗"* —
  `target="_blank" rel="noopener noreferrer"`, pointing at `toShareUrl(formUrl)`. The escape hatch for
  anyone whose browser blocks third-party frames.

### 9. `src/app/join/page.tsx` (new)

Server component, `export const metadata`, and **`export const dynamic = "force-dynamic"`** — it now
reads the settings row from the DB on every request.

Reuse the existing design system rather than inventing anything:
- `MechaPanel` (`src/components/cp-arena/MechaPanel.tsx`) for cards — takes `label` / `index` /
  `ticks` / `bodyClassName`.
- `Reveal` (`src/components/Reveal.tsx`) for scroll-in, staggered via `delay={i * 0.08}`.
- `Link` from **`@/components/AppLink`**, never `next/link` — it defaults `prefetch={false}`; the
  header comment explains that Next 16 prefetch loops on the Cloudflare edge and once burned ~285k
  requests in 6h.
- `.mecha-btn`, `.mecha-btn--solid`; `font-display` / `text-chocolate` / `text-bronze` /
  `border-hairline` tokens from `globals.css`.

Content — answer an applicant's questions, don't replay homepage marketing:

1. **Hero** — "Recruitments {cycle} are open", one-line pitch, closing date.
2. **Who can apply** — year/branch eligibility. *(Needs your input.)*
3. **Domains you can apply to** — the club's de-facto taxonomy, currently free text in the `role`
   field of `public/team/<year>/<group>/<person>/info.json`: **CP, Events, Social Media, Sponsorship,
   Frontend, Backend, Problem Setting, Content, Operations**. Confirm/trim this list; it should match
   the domain options on the form.
4. **What you get** — condensed from the `benefits` array (`src/app/page.tsx:34–56`).
5. **Register first** — a callout linking to `/register`, explaining the arena-username question.
6. **The form** — `<GoogleFormEmbed />`.
7. **What happens next** — shortlist → interview → results. *(Needs your input.)*

**Closed state** — when `isOpen` is false *or* `formUrl` is null, render steps 1 and 7 plus
"applications are closed for {cycle} — follow us on Instagram for the next drive" (socials already in
`src/components/Footer.tsx`) instead of the embed. The null-URL case matters: it's what a freshly
migrated production DB looks like before an admin configures anything.

### 10. Entry points — three small edits

| File | Change |
|---|---|
| `src/components/Navbar.tsx:10` | Add `{ href: "/join", label: "Join" }` to the `links` array |
| `src/components/Footer.tsx:5` | Add the same to the `explore` array |
| `src/app/page.tsx:~245` | Add the missing **"Apply now →"** CTA button under the "What you get as a member" grid |

That homepage CTA is the highest-value line in this plan: the section already sells membership and
currently dead-ends.

**Optional:** the `benefits` array and its four icon components are local to `src/app/page.tsx`.
Extracting them to a shared module would let `/join` reuse them instead of restating the copy. Worth
doing only to avoid maintaining two versions of that text — it's a homepage refactor, fine to skip.

---

## Verification

`npm install` first — the repo needs it before anything builds.

1. `npm run db:generate`, then `npm run dev` (migrations auto-apply locally via `instrumentation.ts`).
2. **Admin gate** — visit `/admin/recruitment` signed out and as a non-admin: both redirect to `/`.
   Then `curl -X PATCH localhost:3000/api/admin/recruitment` with no session → **403**, proving the
   route is gated independently of the page.
3. **Reproduce the CSP block before fixing it.** With `/join` built and a form URL saved, but *before*
   the `next.config.ts` edit: open `/join` → confirm a **blank frame** and
   `Refused to frame 'https://docs.google.com/'` in the console. This proves `headers()` applies in
   dev and that the one-token change is what fixes it — otherwise the CSP edit is unverified
   superstition.
4. Apply the CSP change, restart dev, reload → the form renders.
5. `curl -I http://localhost:3000/join | grep -i content-security` → `docs.google.com` present in
   `frame-src`, nothing else moved.
6. **The admin round trip** — the point of the whole feature. In `/admin/recruitment`: save a bad URL
   (`https://example.com/x`) → inline error, nothing saved. Save a real form URL → `/join` shows that
   form. Toggle **Open** off → `/join` shows the closed state. Toggle back on → form returns. All
   without a restart.
7. **Fresh-DB state** — with no settings row at all, `/join` renders the closed state and doesn't
   crash.
8. **Submit a real test response** end-to-end and confirm it lands in the linked Sheet, including the
   arena-username field.
9. **Dark mode** — toggle via the navbar; the white form should sit in its container as a deliberate
   card, not a broken patch.
10. **Mobile** — narrow to ~375px; no horizontal scroll, form usable. This is where an embed is
    weakest, so check it properly.
11. **Admin nav** — after the layout extraction, all five admin pages show the same nav, including
    `/admin/teachers` (which had none) and the two problem pages.
12. `npm run lint` and `npm run test` (the new `src/lib/recruitment.test.ts` runs here).

Commit the `AGENTS.md` / `CLAUDE.md` block if `next dev` re-adds it — per `AGENTS.md`, dropping it
from the diff only recreates the uncommitted change.

**On deploy:** run `npx wrangler d1 migrations apply pesuecc-arena --remote`, then set the form URL in
`/admin/recruitment` on production — the settings row does not travel with the code.

---

## Follow-up (out of scope)

Once this drive closes, the native version is worth building with no deadline pressure: an
`applications` table, a login-gated form reusing the verified accounts and unique `SRN`/`PRN` you
already have, a review queue extending `/admin/recruitment`, and xlsx export via the existing
`src/lib/monstr-excel-export.ts`. The arena-username field added to the form now is what makes
migrating this year's responses into it possible. One further gap it would need to close: accepted
members still reach `/team` only by hand-committing a JSON file and a photo to `public/team/`.
