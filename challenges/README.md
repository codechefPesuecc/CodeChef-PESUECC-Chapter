# Authoring a Problem of the Day

Each problem is **one JSON file** containing everything: the statement, the
samples, the **hidden tests**, and the checker. These files are the authoring
source: they're **git-ignored** and loaded into the database with the seed script
(below), so the hidden tests never enter the repo. Keep them somewhere private to
the setting team.

## Flow

1. Copy an existing file as a starting point.
2. Name it `YYYY-MM-DD-kebab-title.json`, where the date is the day it should go
   live. **Future-dated problems are not served by the app** — the statement, its
   samples, and its hidden tests stay invisible until that date arrives — so you
   can queue problems ahead of time.
3. Validate: `npm run challenges:validate`.
4. Seed it into the database: `npm run challenges:seed` (local) or
   `npm run challenges:seed -- --target remote` (production D1). Publishing is a
   database write — no redeploy — and it releases automatically at the top of its
   date.

## Schema

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | – | Integer. Currently `1`. |
| `slug` | – | Lowercase letters/digits/hyphens. Defaults to the filename; if set, must match it. |
| `title` | ✓ | Display title. |
| `difficulty` | – | One of `Easy`, `Medium`, `Hard`, `Unrated`. |
| `tags` | – | Array of strings. |
| `date` | ✓ | `YYYY-MM-DD`, a real calendar date. Release day. |
| `timeLimit` | – | e.g. `"1s"`, `"500ms"`. Enforced by the judge (TLE). |
| `memoryLimit` | – | Display only for now, e.g. `"256 MB"`. |
| `author` | – | Credit line. |
| `statement` | ✓ | Markdown. Inline code and fenced blocks render. |
| `inputFormat` / `outputFormat` / `constraints` | – | Markdown. |
| `samples` | ✓ | ≥1 `{ input, output, explanation? }`. Shown to solvers. |
| `tests` | ✓ | ≥1 `{ input, output }`. **Hidden** — never sent to the client. |
| `checker` | – | `{ "type": "token" \| "exact" \| "float", "epsilon"? }`. Defaults to `token`. |

There is **no `points` field** — scoring is server-side: the live Problem of the
Day is a speed bounty (finish order), and a past problem solved for practice earns
a flat base score.

## Checkers

- **`token`** (default): whitespace-insensitive token-by-token match. Use for
  most integer/string answers.
- **`exact`**: byte-for-byte (trailing newlines ignored). Use when spacing
  matters.
- **`float`**: token match with numeric tolerance `epsilon` (default `1e-6`).

## Validate & seed locally

```bash
npm run challenges:validate
npm run challenges:seed
```
