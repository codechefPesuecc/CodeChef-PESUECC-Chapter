# Vision — CodeChef PESUECC Chapter Platform 💻🌾

> **We are not building a judge. We are building the home base of the chapter** — a place
> where a PES first-year goes from *"never written a loop"* to *placed and competitive*,
> surrounded by people they actually know.

This document is the long-term north star for the platform. Features come and go; this is the
"why" that should outlive any single committee. If you are deciding what to build next, measure
it against this document, not against a feature checklist.

---

## 1. The one question that can kill this project

> *"Why not just tell everyone to use CodeChef / Codeforces / LeetCode?"*

We will **never** out-judge Codeforces, and we should never try. The moment this becomes "a worse
global judge," it is dead. The entire bet is on the four things a global platform **structurally
cannot** give a PES student:

1. **Locality** — a leaderboard where the names are people in your class, your batch, your branch.
   Beating the person two rows over beats being global rank 47,000. Our SRN/PRN-based identity
   makes this real: this is *your campus*, not an anonymous ocean.
2. **Guidance** — global judges drop you into the deep end. We are a **ladder**: 0 -> interview-ready
   -> competitive, with prerequisites and curated paths. Our initiatives (LeetCode 101, AlgoHunt,
   Praxis) are already the skeleton of this.
3. **Events** — the chapter *runs* things: contests, workshops, hunts. Those should **live on the
   platform**, not scattered across a WhatsApp group and a Google Form.
4. **Continuity** — clubs suffer amnesia every year when seniors graduate. A platform that keeps the
   problem bank, editorials, contest archive, and hall of fame makes knowledge **compound across
   batches**. This is our most underrated moat.

---

## 2. The north star metric

Not "features shipped." We are winning when:

> **A first-year gets their first `AC` in their first session — and comes back next week for the contest.**

If that is happening, the vision is working. If it is not, no amount of features matters. Everything
below exists to make that sentence true, repeatedly, for hundreds of students.

---

## 3. The arc — where the platform goes, in order

Each phase assumes the previous one is real. Do not skip ahead.

### Phase 1 — A living judge
The core loop works end to end: write code -> Run -> Submit -> verdict -> leaderboard. A curated
problem bank (not one stale problem), and a genuine **Problem of the Day**. The goal of this phase is
a single word: **habit**. Ship state: the arena is worth opening every day.

### Phase 2 — The heartbeat
Weekly contests with a live, freezable scoreboard. Batch-vs-batch and branch-vs-branch rivalries.
Streaks. The chapter's *actual events* run on the platform. This is what makes people show up every
week instead of once. Ship state: the club has a rhythm you can feel.

### Phase 3 — The ladder (our killer differentiator)
Structured learning tracks from beginner -> placement DSA -> competitive, with guided progression,
prerequisites, and editorials. This is what beats "just use Codeforces," and it plugs directly into
what PES students are actually anxious about: **getting placed**. "Practice CP" is abstract; "the
track that gets you interview-ready" is not. Ship state: a student can point at a path and follow it.

### Phase 4 — The institution
Persistent profiles, certificates, a hall of fame, a searchable contest archive, and an **editorial
library authored by seniors for juniors**. Add a mentor / alumni layer. Ship state: the platform is
worth *more* every semester instead of resetting to zero. This is where continuity becomes a real,
compounding asset.

### Phase 5 — The flywheel (optional ambition)
Once it is proven at ECC: template it to other PES campuses and chapters, run inter-chapter contests,
and open problem-authoring to the wider community. Ship state: this is *the* PES competitive
programming platform, not one club's side project.

---

## 4. Design principles (how we decide)

- **Local beats global.** When a feature could be "generic judge feature" or "thing only *our*
  chapter can do," always build the second.
- **Onboarding is sacred.** Every change is judged first by its effect on a scared first-year's
  first session. Friction there is the most expensive bug we can ship.
- **The club's events are first-class.** If the chapter runs it in real life, it should have a home
  on the platform.
- **Nothing resets in June.** Prefer designs where knowledge, profiles, and history persist across
  graduating batches.
- **Integrity is the product.** A leaderboard people trust is the whole point. Anti-cheat, honest
  verdicts, and fair contests are features, not chores. (See `CODE_OF_CONDUCT.md`.)
- **Table stakes stay invisible.** The judge, auth, and reliability must "just work" so the
  interesting work (Phases 2-4) is where our energy goes.

---

## 5. What this is *not*

- Not a Codeforces / LeetCode replacement. Those are table stakes we run *underneath* the real value.
- Not a static brochure site. The newsroom, arena, and team pages are meant to be *alive*.
- Not a single committee's project. It is designed to be inherited. If you are reading this as the
  next core team: this is yours now — extend it.

---

*Maintained by the CodeChef PESUECC Chapter core team. Last reviewed: August 2026.*
