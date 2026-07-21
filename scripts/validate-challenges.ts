/**
 * Validates every problem JSON in `/challenges` against the Arena schema.
 *
 * Runs locally (`npm run challenges:validate`) and in CI on any PR that touches
 * `challenges/**`, so a malformed problem — a missing hidden test, a bad date, a
 * stray `points` field — is caught in review instead of at release time.
 *
 *   node --import tsx scripts/validate-challenges.ts
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const CHALLENGES_DIR = path.join(process.cwd(), "challenges");

/** True for a syntactically valid AND real calendar date (YYYY-MM-DD). */
function isRealDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

const TestCase = z.object({
  input: z.string(),
  output: z.string(),
});

const Sample = z.object({
  input: z.string(),
  output: z.string(),
  explanation: z.string().optional(),
});

const Checker = z
  .object({
    type: z.enum(["exact", "token", "float"]),
    epsilon: z.number().positive().optional(),
  })
  .optional();

const ChallengeSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "must be lowercase letters, digits and hyphens")
    .optional(),
  title: z.string().min(1, "is required"),
  difficulty: z.enum(["Easy", "Medium", "Hard", "Unrated"]).optional(),
  tags: z.array(z.string()).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
    .refine(isRealDate, "must be a real calendar date"),
  timeLimit: z
    .string()
    .regex(/^[\d.]+\s*(ms|s)?$/i, 'must look like "1s", "2 s" or "500ms"')
    .optional(),
  memoryLimit: z.string().optional(),
  author: z.string().optional(),
  statement: z.string().min(1, "is required"),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  constraints: z.string().optional(),
  samples: z.array(Sample).min(1, "at least one sample is required"),
  tests: z.array(TestCase).min(1, "at least one hidden test is required"),
  checker: Checker,
});

const KNOWN_KEYS = new Set(Object.keys(ChallengeSchema.shape));

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

    // The filename is the slug's source of truth; keep them aligned.
    if (!stem.startsWith(c.date)) {
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
