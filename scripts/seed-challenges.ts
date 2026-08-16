/**
 * Loads the authoring JSON in `/challenges` into the `challenges` table.
 * Publishing a problem is running this — no redeploy. Idempotent: every problem
 * is upserted on its `slug`, so re-running reflects edits without duplicates and
 * without touching a row's original `created_at`.
 *
 *   npm run challenges:seed                      # local dev DB (DATABASE_URL, default data/arena.db)
 *   npm run challenges:seed -- --target remote   # production Cloudflare D1 (via wrangler)
 *
 * Every file is validated with the shared schema first; the seed aborts if any
 * file is invalid (same rules as `npm run challenges:validate`). Files removed
 * from the folder are NOT deleted from the DB — that's a deliberate, separate
 * action so a stray `rm` can't unpublish a live problem.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { challenges, type NewChallengeRow } from "../src/server/db/schema";
import { renderMarkdown } from "../src/lib/markdown";
import {
  CHALLENGES_DIR,
  ChallengeSchema,
  resolveSlug,
} from "./challenge-schema";

const D1_DATABASE = "pesuecc-arena";

function parseTarget(): "local" | "remote" {
  const i = process.argv.indexOf("--target");
  const t = i >= 0 ? process.argv[i + 1] : "local";
  if (t !== "local" && t !== "remote") {
    console.error(`Unknown --target "${t}" (expected "local" or "remote").`);
    process.exit(1);
  }
  return t;
}

/** Reads + validates every challenge file, renders its Markdown prose to sanitized
 * HTML, and returns DB rows (or exits on error). */
async function loadRows(): Promise<NewChallengeRow[]> {
  let files: string[];
  try {
    files = fs.readdirSync(CHALLENGES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`No challenges directory at ${CHALLENGES_DIR}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.log("No challenge files to seed.");
    process.exit(0);
  }

  const now = Date.now();
  const rows: NewChallengeRow[] = [];
  const slugsSeen = new Map<string, string>();
  let hadError = false;

  for (const file of files.sort()) {
    const full = path.join(CHALLENGES_DIR, file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (e) {
      console.error(`✗ ${file}: invalid JSON — ${(e as Error).message}`);
      hadError = true;
      continue;
    }
    if (raw && typeof raw === "object" && "points" in (raw as object)) {
      console.error(`✗ ${file}: \`points\` was removed — scoring is server-side`);
      hadError = true;
      continue;
    }
    const parsed = ChallengeSchema.safeParse(raw);
    if (!parsed.success) {
      hadError = true;
      for (const issue of parsed.error.issues) {
        console.error(
          `✗ ${file}: ${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`,
        );
      }
      continue;
    }
    const c = parsed.data;
    const slug = resolveSlug(c, file);
    const dupe = slugsSeen.get(slug);
    if (dupe) {
      console.error(`✗ ${file}: duplicate slug "${slug}" (also in ${dupe})`);
      hadError = true;
      continue;
    }
    slugsSeen.set(slug, file);

    // Pre-render the Markdown prose to sanitized HTML now, so the request path
    // serves stored HTML and never loads the Markdown pipeline (see #120).
    const contentHtml = JSON.stringify({
      statement: await renderMarkdown(c.statement),
      inputFormat: await renderMarkdown(c.inputFormat ?? ""),
      outputFormat: await renderMarkdown(c.outputFormat ?? ""),
      constraints: await renderMarkdown(c.constraints ?? ""),
      sampleExplanations: await Promise.all(
        c.samples.map((s) => renderMarkdown(s.explanation ?? "")),
      ),
    });

    rows.push({
      slug,
      title: c.title,
      difficulty: c.difficulty ?? "Unrated",
      tags: JSON.stringify(c.tags ?? []),
      date: c.date,
      timeLimit: c.timeLimit ?? null,
      memoryLimit: c.memoryLimit ?? null,
      author: c.author ?? null,
      statement: c.statement,
      inputFormat: c.inputFormat ?? null,
      outputFormat: c.outputFormat ?? null,
      constraints: c.constraints ?? null,
      samples: JSON.stringify(c.samples),
      contentHtml,
      tests: JSON.stringify(c.tests),
      checker: JSON.stringify(c.checker ?? { type: "token" }),
      schemaVersion: c.schemaVersion ?? 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (hadError) {
    console.error("\nSeeding aborted — fix the errors above.");
    process.exit(1);
  }
  return rows;
}

/** Columns updated on conflict — everything except the identity (slug) and the
 * immutable created_at, so an edit preserves the original publish timestamp. */
function updateSet(row: NewChallengeRow) {
  const { slug: _slug, createdAt: _createdAt, ...rest } = row;
  void _slug;
  void _createdAt;
  return rest;
}

async function seedLocal(rows: NewChallengeRow[]): Promise<void> {
  const url = process.env.DATABASE_URL ?? "file:./data/arena.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient(authToken ? { url, authToken } : { url });
  const db = drizzle(client, { schema: { challenges } });
  for (const row of rows) {
    await db
      .insert(challenges)
      .values(row)
      .onConflictDoUpdate({ target: challenges.slug, set: updateSet(row) });
  }
  console.log(`Seeded ${rows.length} challenge(s) into ${url}`);
}

// ── Remote (Cloudflare D1) ──────────────────────────────────────────────────
// Node can't bind to a remote D1 directly, so generate an upsert script and run
// it through wrangler. SQLite string literals only need single quotes doubled;
// newlines inside the literal are fine.

const COLUMNS = [
  "slug", "title", "difficulty", "tags", "date", "time_limit", "memory_limit",
  "author", "statement", "input_format", "output_format", "constraints",
  "samples", "content_html", "tests", "checker", "schema_version", "created_at", "updated_at",
] as const;

function lit(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

function seedRemote(rows: NewChallengeRow[]): void {
  const updateCols = COLUMNS.filter((c) => c !== "slug" && c !== "created_at");
  const statements = rows.map((r) => {
    const values = [
      r.slug, r.title, r.difficulty ?? "Unrated", r.tags ?? "[]", r.date,
      r.timeLimit ?? null, r.memoryLimit ?? null, r.author ?? null, r.statement,
      r.inputFormat ?? null, r.outputFormat ?? null, r.constraints ?? null,
      r.samples ?? "[]", r.contentHtml ?? null, r.tests ?? "[]", r.checker ?? '{"type":"token"}',
      r.schemaVersion ?? 1, r.createdAt, r.updatedAt,
    ].map(lit).join(", ");
    const setClause = updateCols.map((c) => `${c} = excluded.${c}`).join(", ");
    return `INSERT INTO challenges (${COLUMNS.join(", ")}) VALUES (${values}) ON CONFLICT(slug) DO UPDATE SET ${setClause};`;
  });

  const tmp = path.join(os.tmpdir(), `seed-challenges-${process.pid}.sql`);
  fs.writeFileSync(tmp, statements.join("\n") + "\n", "utf8");
  try {
    const res = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", D1_DATABASE, "--remote", "--file", tmp],
      { stdio: "inherit", shell: true },
    );
    if (res.status !== 0) {
      console.error("wrangler d1 execute failed.");
      process.exit(res.status ?? 1);
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  console.log(`Seeded ${rows.length} challenge(s) into remote D1 (${D1_DATABASE})`);
}

async function main() {
  const target = parseTarget();
  const rows = await loadRows();
  if (target === "remote") seedRemote(rows);
  else await seedLocal(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
