import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_ROOT = path.join(ROOT, "content", "initiatives");
const OUT = path.join(ROOT, "src", "app", "initiatives", "initiatives.manifest.json");

/** Safe directory listing — returns [] if the dir doesn't exist. */
function readdirSafe(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".md"))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Scan /content/initiatives into { events, systems } and write the manifest. */
export function buildInitiativesManifest() {
  const eventsDir = path.join(CONTENT_ROOT, "events");
  const systemsDir = path.join(CONTENT_ROOT, "systems");

  const events = [];
  for (const file of readdirSafe(eventsDir)) {
    const raw = fs.readFileSync(path.join(eventsDir, file), "utf8");
    const { data, content } = matter(raw);
    events.push({ ...data, detailedExplanation: content.trim() });
  }
  // Sort events by accent (01, 02, etc.) to maintain original order
  events.sort((a, b) => (a.accent || "").localeCompare(b.accent || ""));

  const systems = [];
  for (const file of readdirSafe(systemsDir)) {
    const raw = fs.readFileSync(path.join(systemsDir, file), "utf8");
    const { data } = matter(raw);
    systems.push({ ...data });
  }

  const json = JSON.stringify({ events, systems }, null, 2) + "\n";
  
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
  
  return { events: events.length, systems: systems.length };
}

// Allow running directly: `node scripts/build-initiatives.mjs`
const invoked = (process.argv[1] ?? "").replace(/\\/g, "/");
if (invoked.endsWith("build-initiatives.mjs")) {
  const counts = buildInitiativesManifest();
  console.log(`[initiatives] manifest written with ${counts.events} event(s) and ${counts.systems} system(s)`);
}
