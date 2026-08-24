import { z } from "zod";

/**
 * The authoring schema for a problem, shared by the seed/validate scripts and the
 * admin console. Pure (no fs/path/process) so it can be imported into the app and
 * the Cloudflare Worker bundle. The Node-only bits (CHALLENGES_DIR, resolveSlug)
 * stay in scripts/challenge-schema.ts, which re-exports everything here.
 */

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
  // Omit / null = in the pool (unscheduled). Set = the IST day this problem is
  // (or was) the Problem of the Day. Live only on the exact day; before it, it's
  // queued; after it, it drops to the practice archive.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
    .refine(isRealDate, "must be a real calendar date")
    .nullish(),
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

/**
 * The admin console submits a complete problem, so the slug is required there (the
 * seed's filename fallback doesn't exist). Callers that need a guaranteed slug use
 * this stricter schema.
 */
export const AdminChallengeSchema = ChallengeSchema.extend({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "must be lowercase letters, digits and hyphens"),
});

export const KNOWN_KEYS = new Set(Object.keys(ChallengeSchema.shape));
