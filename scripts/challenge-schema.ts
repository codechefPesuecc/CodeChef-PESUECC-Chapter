import path from "node:path";

/**
 * Node-only bits of the problem authoring schema (filesystem path + filename slug
 * fallback). The pure schema itself lives in `src/lib/challenge-schema.ts` and is
 * re-exported here, so `validate-challenges.ts` and `seed-challenges.ts` keep their
 * existing `./challenge-schema` imports unchanged.
 */

export {
  ChallengeSchema,
  AdminChallengeSchema,
  isRealDate,
  KNOWN_KEYS,
  type ChallengeInput,
} from "../src/lib/challenge-schema";

export const CHALLENGES_DIR = path.join(process.cwd(), "challenges");

/** The slug is the explicit `slug` field, else the filename stem. */
export function resolveSlug(data: { slug?: string }, file: string): string {
  return data.slug ?? file.replace(/\.json$/, "");
}
