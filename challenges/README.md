# Contributing a Problem of the Day

Problems live in the **database** (Cloudflare D1), not the repo. Publishing is a
database write — **no redeploy** — and a problem releases automatically at the top
of its `date` (IST). Future-dated problems (and their hidden tests) stay invisible
until that date arrives, so you can queue problems ahead of time.

There are **two ways** to add a problem. Both take exactly the same fields, so a
JSON authored for one works for the other (see [Schema](#schema)).

## 1. Admin console (quickest — for admins)

If you have an admin account, open **`/admin` → New problem** and fill in the form:
metadata, the Markdown statement / input / output / constraints (with a live
preview), the samples, the **hidden tests**, and the checker.

Already have the problem as JSON? Click **Import from JSON** and paste it — or
upload the `.json` file — and it fills the whole form for you to review, then click
**Create**. This writes straight to D1: no CLI, no redeploy.

## 2. JSON file + seed script (the source-of-record path)

Each problem is **one JSON file** containing everything: the statement, the samples,
the **hidden tests**, and the checker. These files are the authoring source —
they're **git-ignored** (so the hidden tests never enter the public repo) and loaded
into D1 with the seed script. Keep them somewhere private to the setting team.

1. Copy an existing file (or the [example](#example) below) as a starting point.
2. Name it `YYYY-MM-DD-kebab-title.json`, where the date is the day it should go
   live.
3. Validate: `npm run challenges:validate`.
4. Seed it into the database: `npm run challenges:seed` (local dev DB) or
   `npm run challenges:seed -- --target remote` (production D1).

This is the canonical path for bulk authoring, CI validation, and contributors
without an admin login. (The admin console's **Import from JSON** accepts the exact
same file.)

## Schema

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | – | Integer. Currently `1`. |
| `slug` | – | Lowercase letters/digits/hyphens. In a file it defaults to the filename (and, if set, must match it); the admin importer derives it from the title when absent. |
| `title` | ✓ | Display title. |
| `difficulty` | – | One of `Easy`, `Medium`, `Hard`, `Unrated`. |
| `tags` | – | Array of strings. |
| `date` | ✓ | `YYYY-MM-DD`, a real calendar date. Release day (IST). |
| `timeLimit` | – | e.g. `"1s"`, `"500ms"`. Enforced by the judge (TLE). |
| `memoryLimit` | – | Display only for now, e.g. `"256 MB"`. |
| `author` | – | Credit line. |
| `statement` | ✓ | Markdown. Inline code, fenced blocks, tables, and lists render. |
| `inputFormat` / `outputFormat` / `constraints` | – | Markdown. |
| `samples` | ✓ | ≥1 `{ input, output, explanation? }`. Shown to solvers. |
| `tests` | ✓ | ≥1 `{ input, output }`. **Hidden** — never sent to the client. |
| `checker` | – | `{ "type": "token" \| "exact" \| "float", "epsilon"? }`. Defaults to `token`. |

There is **no `points` field** — scoring is server-side: the live Problem of the
Day is a speed bounty (ranked by solve time — the fastest accepted solve wins), and
a past problem solved for practice earns a flat base score.

## Example

A complete, minimal problem:

```json
{
  "title": "Sum of Two Numbers",
  "date": "2026-07-20",
  "difficulty": "Easy",
  "tags": ["math", "implementation"],
  "timeLimit": "1s",
  "memoryLimit": "256 MB",
  "author": "Your Name",
  "statement": "Read two integers **a** and **b** and print their sum.",
  "inputFormat": "A single line with two space-separated integers `a` and `b`.",
  "outputFormat": "A single integer — the value of `a + b`.",
  "constraints": "`-10^9 <= a, b <= 10^9`",
  "samples": [
    { "input": "2 3", "output": "5", "explanation": "2 + 3 = 5." }
  ],
  "tests": [
    { "input": "2 3", "output": "5" },
    { "input": "-1000000000 -1000000000", "output": "-2000000000" },
    { "input": "0 0", "output": "0" }
  ],
  "checker": { "type": "token" }
}
```

Save it as `challenges/2026-07-20-sum-of-two-numbers.json`. Put the tricky cases —
empty input, maximum constraints, ties, boundary values — in `tests`; that's what
makes the judge real.

## Checkers

- **`token`** (default): whitespace-insensitive token-by-token match. Use for most
  integer/string answers.
- **`exact`**: byte-for-byte (trailing newlines ignored). Use when spacing matters.
- **`float`**: token match with numeric tolerance `epsilon` (default `1e-6`).

## Validate & seed locally

```bash
npm run challenges:validate
npm run challenges:seed
```
