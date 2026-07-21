import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MemberInfo {
  /** Display name from info.json */
  name: string;
  /** Role / title, e.g. "Core Team — Tech Lead" */
  role: string;
  /** Short 1-2 line bio */
  bio: string;
  /** Social links — empty string means "not provided" */
  linkedin: string;
  github: string;
  instagram: string;
  /** URL-safe path to the photo relative to `/` (served from public/) */
  photo: string;
}

export interface YearData {
  year: string;
  coordinators: MemberInfo[];
  core: MemberInfo[];
  members: MemberInfo[];
}

export interface TeamData {
  /** Available years sorted newest-first */
  years: string[];
  /** Pre-loaded data for every year, keyed by year string */
  byYear: Record<string, YearData>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TEAM_ROOT = path.join(process.cwd(), "public", "team");

/** Safe directory listing — returns [] if the dir doesn't exist. */
function readdirSafe(dir: string): string[] {
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
function resolvePhoto(memberDir: string, publicPrefix: string): string {
  const exts = [".jpg", ".jpeg", ".png", ".svg", ".webp"];
  for (const ext of exts) {
    const candidate = path.join(memberDir, `photo${ext}`);
    if (fs.existsSync(candidate)) {
      return `${publicPrefix}/photo${ext}`;
    }
  }
  // Fallback: empty string → the card component will render initials instead.
  return "";
}

/** Read and parse a member's info.json. Returns null on failure. */
function readMemberInfo(
  memberDir: string,
  publicPrefix: string,
): MemberInfo | null {
  const infoPath = path.join(memberDir, "info.json");
  try {
    const raw = fs.readFileSync(infoPath, "utf-8");
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
function loadGroup(yearDir: string, group: string, year: string): MemberInfo[] {
  const groupDir = path.join(yearDir, group);
  const slugs = readdirSafe(groupDir);
  const members: MemberInfo[] = [];

  for (const slug of slugs) {
    const memberDir = path.join(groupDir, slug);
    const publicPrefix = `/team/${year}/${group}/${slug}`;
    const info = readMemberInfo(memberDir, publicPrefix);
    if (info) members.push(info);
  }

  // Sort alphabetically by name for deterministic ordering.
  members.sort((a, b) => a.name.localeCompare(b.name));
  return members;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Discover all available years by scanning `public/team/`.
 * Returns newest year first.
 */
export function getAvailableYears(): string[] {
  return readdirSafe(TEAM_ROOT).sort((a, b) => b.localeCompare(a));
}

/** Load all three groups for a single year. */
export function getYearData(year: string): YearData {
  const yearDir = path.join(TEAM_ROOT, year);
  return {
    year,
    coordinators: loadGroup(yearDir, "coordinator", year),
    core: loadGroup(yearDir, "core", year),
    members: loadGroup(yearDir, "members", year),
  };
}

/**
 * Load every year's data in one shot. Used by the server component so the
 * client receives all data upfront and can switch years without fetching.
 */
export function getAllTeamData(): TeamData {
  const years = getAvailableYears();
  const byYear: Record<string, YearData> = {};
  for (const year of years) {
    byYear[year] = getYearData(year);
  }
  return { years, byYear };
}
