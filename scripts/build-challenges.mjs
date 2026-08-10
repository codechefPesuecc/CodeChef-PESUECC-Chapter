// Bundles the GitOps challenge JSON in /challenges into a single manifest that
// the app imports at build time. Cloudflare Workers have no filesystem, so the
// problems can't be read with `fs` at runtime — they ride in the bundle instead.
//
// Runs from next.config.ts (dev + next build + opennextjs-cloudflare build) and
// standalone via `npm run challenges:build`. Writes only when the content
// changes, so it never triggers a dev-server reload loop. The raw JSON is stored
// as-is; all normalization/validation stays in src/lib/challenges.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHALLENGES_DIR = path.join(ROOT, "challenges");
const OUT = path.join(ROOT, "src", "lib", "challenges.manifest.json");

/** Reads /challenges/*.json into [{ file, data }] and writes the manifest. */
export function buildChallengesManifest() {
  let files = [];
  try {
    files = fs.readdirSync(CHALLENGES_DIR);
  } catch {
    files = [];
  }

  const entries = files
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(CHALLENGES_DIR, file), "utf8");
      try {
        return { file, data: JSON.parse(raw) };
      } catch {
        // Skip malformed JSON — validation is the app's job, but invalid JSON
        // can't be embedded at all.
        return null;
      }
    })
    .filter((e) => e !== null);

  const json = JSON.stringify(entries, null, 2) + "\n";
  let existing = null;
  try {
    existing = fs.readFileSync(OUT, "utf8");
  } catch {
    existing = null;
  }
  if (existing !== json) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, json);
  }
  return entries.length;
}

// Allow running directly: `node scripts/build-challenges.mjs`
const invoked = (process.argv[1] ?? "").replace(/\\/g, "/");
if (invoked.endsWith("build-challenges.mjs")) {
  const n = buildChallengesManifest();
  console.log(`[challenges] manifest written with ${n} problem(s)`);
}
