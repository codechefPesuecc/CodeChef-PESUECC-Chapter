// Bundles the team roster in /public/team into a single manifest that the app
// imports at build time. Cloudflare Workers have no filesystem, so the member
// info.json files can't be read with `fs` at runtime — they ride in the bundle
// instead (this is why the team page rendered empty on Workers while working
// locally). Photos stay as static assets served by the ASSETS binding; only the
// discovery/parsing of info.json moves to build time.
//
// Runs from next.config.ts (dev + next build + opennextjs-cloudflare build) and
// standalone via `npm run team:build`. Writes only when the content changes, so
// it never triggers a dev-server reload loop.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEAM_ROOT = path.join(ROOT, "public", "team");
const OUT = path.join(ROOT, "src", "app", "team", "team.manifest.json");

/** Safe directory listing — returns [] if the dir doesn't exist. */
function readdirSafe(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Resolve a photo file inside a member folder. Supports jpg/png/svg/webp. */
function resolvePhoto(memberDir, publicPrefix) {
  const exts = [".jpg", ".jpeg", ".png", ".svg", ".webp"];
  for (const ext of exts) {
    if (fs.existsSync(path.join(memberDir, `photo${ext}`))) {
      return `${publicPrefix}/photo${ext}`;
    }
  }
  // Empty string → the card component renders initials instead.
  return "";
}

/** Read and parse a member's info.json. Returns null on failure. */
function readMemberInfo(memberDir, publicPrefix) {
  try {
    const raw = fs.readFileSync(path.join(memberDir, "info.json"), "utf8");
    const json = JSON.parse(raw);
    return {
      name: json.name ?? "",
      role: json.role ?? "",
      bio: json.bio ?? "",
      linkedin: json.linkedin ?? "",
      github: json.github ?? "",
      instagram: json.instagram ?? "",
      photo: resolvePhoto(memberDir, publicPrefix),
    };
  } catch {
    return null;
  }
}

/** Load all members from a role directory (coordinator | core | members). */
function loadGroup(yearDir, group, year) {
  const groupDir = path.join(yearDir, group);
  const members = [];
  for (const slug of readdirSafe(groupDir)) {
    const info = readMemberInfo(
      path.join(groupDir, slug),
      `/team/${year}/${group}/${slug}`,
    );
    if (info) members.push(info);
  }
  members.sort((a, b) => a.name.localeCompare(b.name));
  return members;
}

/** Scan /public/team into { years, byYear } and write the manifest. */
export function buildTeamManifest() {
  const years = readdirSafe(TEAM_ROOT).sort((a, b) => b.localeCompare(a));
  const byYear = {};
  for (const year of years) {
    const yearDir = path.join(TEAM_ROOT, year);
    byYear[year] = {
      year,
      coordinators: loadGroup(yearDir, "coordinator", year),
      core: loadGroup(yearDir, "core", year),
      members: loadGroup(yearDir, "members", year),
    };
  }

  const json = JSON.stringify({ years, byYear }, null, 2) + "\n";
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
  return years.length;
}

// Allow running directly: `node scripts/build-team.mjs`
const invoked = (process.argv[1] ?? "").replace(/\\/g, "/");
if (invoked.endsWith("build-team.mjs")) {
  const n = buildTeamManifest();
  console.log(`[team] manifest written with ${n} year(s)`);
}
