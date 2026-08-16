import path from "node:path";
import { z } from "zod";

/**
 * The authoring schema for a problem JSON, shared by `validate-challenges.ts`
 * (the CI/local linter) and `seed-challenges.ts` (which loads problems into the
 * database). Keeping it in one place means both use exactly the same rules.
 */

export const CHALLENGES_DIR = path.join(process.cwd(), "challenges");

/** True for a syntactically valid AND real calendar date (YYYY-MM-DD). */
export function isRealDate(iso: string): boolean {
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

export const ChallengeSchema = z.object({
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

export type ChallengeInput = z.infer<typeof ChallengeSchema>;

export const KNOWN_KEYS = new Set(Object.keys(ChallengeSchema.shape));

/** The slug is the explicit `slug` field, else the filename stem. */
export function resolveSlug(data: { slug?: string }, file: string): string {
  return data.slug ?? file.replace(/\.json$/, "");
}
