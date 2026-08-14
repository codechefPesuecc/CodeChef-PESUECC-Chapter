# Vision — The Newsroom 📰

> The Newsroom is the chapter's **voice, memory, and window on the tech world**. If the CP Arena is
> the heartbeat, the Newsroom is the record of every beat — announcements, contest recaps, event
> stories, and the people behind them — plus a curated feed of the **latest news in technology**, so
> members stay current with the field they're training for. It is how a first-year discovers what the
> chapter *is*, and how the class of 2030 learns what the class of 2025 built.

This document sets the editorial direction for `/newsroom`. For the platform-wide vision it serves,
see [`VISION.md`](./VISION.md) — specifically **Phase 2 (the heartbeat)** and **Phase 4 (the
institution)**.

---

## 1. Why the Newsroom exists

Most clubs communicate in disappearing channels — a WhatsApp message, an Instagram story, a poster
that comes down the next day. All of it vanishes. New members join and have no idea what happened
last semester. Seniors graduate and their work evaporates.

The Newsroom fixes this. It is the **permanent, public, on-brand home** for everything the chapter
says and does — and a curated window on the wider tech world. Four jobs, in priority order:

1. **Announce** — the authoritative source for "what's happening": upcoming contests, workshops,
   registrations, results.
2. **Recap** — turn every event into a story with real numbers (participants, submissions, winners),
   so the work is remembered and the momentum is visible.
3. **Preserve** — build an archive that makes the chapter's history browsable years later. Continuity
   is a feature, not an afterthought.
4. **Inform** — a curated pulse of the **latest in technology**: industry news, competitive-programming
   and open-source happenings, new tools and breakthroughs worth knowing — each with a short "why it
   matters" for students. Keep members current with the field they're training for, in the chapter's
   own voice.

---

## 2. What it is today

A clean, brand-aligned events grid (`src/app/newsroom/page.tsx`, sourced from `src/lib/events.ts`):
each card shows an event's type, status (Upcoming / Completed), date, tagline, summary, and two
headline stats, linking to a per-event detail page. It looks the part. It is currently **static and
manually authored** — a good foundation, not the destination.

---

## 3. Who maintains it, and how posts are written

**Owner: the SMM (Social Media Management) domain.** The Newsroom is the SMM team's surface — they
write the announcements, contest recaps, member spotlights, and the tech-news digest, and they own
its voice, cadence, and quality. It is the on-site counterpart to the chapter's social channels, run
by the same people.

**Format: Markdown.** Every post is essentially a **Markdown document** — headings, lists, links,
quotes, and **embedded images and media** — rendered by the app into the branded Newsroom layout (the
cream / bronze / chocolate card and typography system used across the site). A small front-matter
block carries the metadata the cards need: title, date, type (announcement / recap / spotlight /
tech news), status, a cover image, and the two headline stats.

**Why Markdown:** it keeps authoring **low-friction for non-developers**. An SMM member writes a post
the way they'd write a doc, drops in the relevant images, and publishes — without touching React.
Images live alongside the post and are served as static assets; the renderer places them inline with
the text.

> Note: like problems and the team roster, Markdown posts bundled into the app publish on a **redeploy**
> (Cloudflare Workers have no filesystem). If SMM's cadence outgrows that, the same runtime-content /
> lightweight-CMS path discussed in #69 applies here — author in Markdown, store and render at
> runtime, no redeploy.

---

## 4. Where it goes

### Phase A — A real feed (from static grid to living stream)
- **Post types beyond events:** short announcements, contest results, member spotlights, editorials,
  and **tech-news posts**.
- **A "Tech Pulse" stream** — a curated digest of the latest in technology (industry moves, CP and
  open-source news, new tools and releases), each item carrying a one-line "why it matters" for
  students. Regular cadence (e.g. a weekly roundup), always in the chapter's voice — never a raw
  copy-paste of someone else's headline.
- **Sort and filter** by type (announcement / recap / spotlight / tech news), status, and date; pin
  the most important post to the top.
- **A single, honest source of truth** for "when is the next contest," surfaced on the home page and
  in the arena, not buried.

### Phase B — Tied to the arena (recaps that write themselves)
The Newsroom should not make an author re-type numbers the platform already knows. After a contest:
- Auto-draft a recap from arena data: participants, total submissions, first-AC, top solvers,
  hardest problem (lowest solve rate). A human adds the narrative; the data comes for free.
- Every contest recap links to its **final standings** and its **editorials**, closing the loop
  between "the event" and "the learning."

### Phase C — The archive (institutional memory)
- A browsable, searchable history of every contest and event, by semester and by year.
- **Member spotlights and a hall of fame** — the students behind the wins become part of the record.
- Editorials authored by seniors live here permanently, so juniors inherit the knowledge instead of
  rediscovering it. This is Phase 4 of the platform vision, made concrete.

### Phase D — The chapter's front page
Once it is alive, the Newsroom becomes the first thing a prospective member sees: proof that this is
an active, serious, welcoming community — with receipts.

---

## 5. Editorial principles

- **On-brand, always.** Warm CodeChef palette (cream `#F5F1EB`, bronze `#A67C52`, chocolate
  `#3E2F24`), premium and uncluttered. The Newsroom represents the chapter — it should look like it.
- **Numbers make it real.** A recap with "112 participants, 480 submissions, 3 first-years in the
  top 10" beats "the contest went well." Pull real data wherever possible.
- **Celebrate people.** Name the winners, the setters, the volunteers. Recognition is fuel.
- **Write for the newcomer.** Assume the reader just found the chapter today. No unexplained jargon,
  no missing context.
- **Curate, don't aggregate.** For tech news, add a chapter point of view and a "why it matters" —
  never just repost a headline, and always credit and link the original source.
- **Nothing disappears.** A post published is a post preserved. The archive is the point — treat
  every entry as something a future member will read.
- **Timely, then timeless.** Announce fast; then, after the event, rewrite the post into a recap so
  the same URL stays useful forever.

---

## 6. Non-goals

- Not a personal blog or an opinion column. The Newsroom speaks for the chapter, not for individuals.
- Not a social feed chasing volume. Fewer, well-made, data-backed posts beat a firehose.
- Not a raw news aggregator. Tech news is hand-picked and contextualized for our members, not an
  auto-scraped stream of every headline.
- Not a replacement for real-time chat (Discord / WhatsApp). Those are for conversation; the Newsroom
  is for the *record*.

---

*Owned by the SMM (Social Media Management) domain, in step with the CodeChef PESUECC Chapter core team.*
