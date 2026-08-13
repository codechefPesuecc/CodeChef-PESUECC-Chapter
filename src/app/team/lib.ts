import teamManifest from "./team.manifest.json";

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
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

// The roster is baked into team.manifest.json at build time by
// scripts/build-team.mjs — Cloudflare Workers can't read public/team with `fs`
// at request time (that made the page render empty in prod). Photos still load
// as static assets from the paths stored in the manifest.
const data = teamManifest as TeamData;

/** Available years, newest first. */
export function getAvailableYears(): string[] {
  return data.years;
}

/** All three groups for a single year (empty groups if the year is unknown). */
export function getYearData(year: string): YearData {
  return data.byYear[year] ?? { year, coordinators: [], core: [], members: [] };
}

/**
 * Every year's data in one shot. Used by the server component so the client
 * receives all data upfront and can switch years without fetching.
 */
export function getAllTeamData(): TeamData {
  return data;
}
