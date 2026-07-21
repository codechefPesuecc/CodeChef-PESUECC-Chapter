# Authoring a Problem of the Day

Each problem is **one JSON file** in this directory containing everything: the
statement, the samples, the **hidden tests**, and the checker. Because the
hidden tests live here, this repo is private to the setting team.

## Flow

1. Copy an existing file as a starting point.
2. Name it `YYYY-MM-DD-kebab-title.json`, where the date is the day it should go
   live. **Future-dated files are not served by the app** — the statement, its
   samples, and its hidden tests stay invisible until that date arrives — so you
   can queue problems ahead of time.
3. Open a PR. The **Validate challenges** GitHub Action runs the schema check
   (`npm run challenges:validate`) and must pass before merge.
4. An admin merges. It releases automatically at the top of its date.

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

There is **no `points` field** — scoring comes from the speed-bounty ladder
(finish order), not the problem file.

## Checkers

- **`token`** (default): whitespace-insensitive token-by-token match. Use for
  most integer/string answers.
- **`exact`**: byte-for-byte (trailing newlines ignored). Use when spacing
  matters.
- **`float`**: token match with numeric tolerance `epsilon` (default `1e-6`).

## Validate locally

```bash
npm run challenges:validate
```
