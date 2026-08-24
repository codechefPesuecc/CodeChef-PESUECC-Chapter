/**
 * Validates every problem JSON in `/challenges` against the Arena schema.
 *
 * Runs locally (`npm run challenges:validate`) and in CI, so a malformed problem
 * — a missing hidden test, a bad date, a stray `points` field — is caught in
 * review before it is ever seeded into the database.
 *
 *   node --import tsx scripts/validate-challenges.ts
 */
import fs from "node:fs";
import path from "node:path";
import { CHALLENGES_DIR, ChallengeSchema, KNOWN_KEYS } from "./challenge-schema";

let files: string[];
try {
  files = fs.readdirSync(CHALLENGES_DIR).filter((f) => f.endsWith(".json"));
} catch {
  console.error(`No challenges directory at ${CHALLENGES_DIR}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log("No challenge files to validate.");
  process.exit(0);
}

let hadError = false;
const slugsSeen = new Map<string, string>();

for (const file of files.sort()) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const full = path.join(CHALLENGES_DIR, file);
  const stem = file.replace(/\.json$/, "");

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    errors.push(`invalid JSON — ${(e as Error).message}`);
    report(file, errors, warnings);
    hadError = true;
    continue;
  }

  const parsed = ChallengeSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path.length ? issue.path.join(".") : "(root)";
      errors.push(`${where}: ${issue.message}`);
    }
  }

  // Stray-key checks against the raw object (the schema ignores unknowns).
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (key === "points") {
        errors.push(
          "`points` was removed — scoring comes from the speed-bounty ladder, not the problem file",
        );
      } else if (!KNOWN_KEYS.has(key)) {
        warnings.push(`unknown field \`${key}\` (ignored by the loader)`);
      }
    }
  }

  if (parsed.success) {
    const c = parsed.data;

    // The filename is the slug's source of truth; keep them aligned. Pooled
    // problems (no date) skip this — their filename isn't date-prefixed.
    if (c.date && !stem.startsWith(c.date)) {
      warnings.push(
        `filename should start with the date — expected "${c.date}-…", got "${stem}"`,
      );
    }
    if (c.slug && c.slug !== stem) {
      warnings.push(
        `slug "${c.slug}" doesn't match filename "${stem}" — the archive links by slug`,
      );
    }

    const slug = c.slug ?? stem;
    const dupe = slugsSeen.get(slug);
    if (dupe) errors.push(`duplicate slug "${slug}" (also in ${dupe})`);
    else slugsSeen.set(slug, file);

    if (c.checker?.type === "float" && c.checker.epsilon === undefined) {
      warnings.push("float checker has no epsilon — the judge will default to 1e-6");
    }
  }

  if (errors.length) hadError = true;
  report(file, errors, warnings);
}

function report(file: string, errors: string[], warnings: string[]) {
  if (!errors.length && !warnings.length) {
    console.log(`  ok   ${file}`);
    return;
  }
  const tag = errors.length ? "FAIL" : "warn";
  console.log(`${errors.length ? "✗" : "!"} ${tag} ${file}`);
  for (const e of errors) console.log(`         error: ${e}`);
  for (const w of warnings) console.log(`         warn:  ${w}`);
}

if (hadError) {
  console.error("\nChallenge validation failed.");
  process.exit(1);
}
console.log(`\nValidated ${files.length} challenge file(s).`);
