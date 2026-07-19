import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Reads the GitOps challenge records in `/challenges` (see README — problem
 * setters push `YYYY-MM-DD-slug.md` files with YAML frontmatter). This runs on
 * the server at build time; the parsed Problem of the Day is passed to the
 * client Arena as plain serializable props.
 */

export interface ChallengeMeta {
  title: string;
  difficulty: string;
  points: number;
  tags: string[];
  date: string; // YYYY-MM-DD
  timeLimit?: string;
  memoryLimit?: string;
  author?: string;
}

export interface Challenge {
  slug: string;
  meta: ChallengeMeta;
  /** Raw markdown body (frontmatter stripped). */
  body: string;
  /** Sample case pulled from the body, used by the client-side runner. */
  sampleInput: string;
  sampleOutput: string;
}

const CHALLENGES_DIR = path.join(process.cwd(), "challenges");

function extractFenced(body: string, heading: string): string {
  const re = new RegExp(
    `#{1,6}\\s+${heading}[^\\n]*\\n+\`\`\`[^\\n]*\\n([\\s\\S]*?)\`\`\``,
    "i",
  );
  const match = body.match(re);
  return match ? match[1].replace(/\s+$/, "") : "";
}

function readChallengeFile(fileName: string): Challenge | null {
  const slug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(CHALLENGES_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  if (!data.title || !data.date) return null;

  const meta: ChallengeMeta = {
    title: String(data.title),
    difficulty: String(data.difficulty ?? "Unrated"),
    points: Number(data.points ?? 100),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    date: String(data.date),
    timeLimit: data.timeLimit ? String(data.timeLimit) : undefined,
    memoryLimit: data.memoryLimit ? String(data.memoryLimit) : undefined,
    author: data.author ? String(data.author) : undefined,
  };

  return {
    slug,
    meta,
    // Drop the leading H1 — the title is rendered in the Arena header instead.
    body: content.trim().replace(/^#\s+.*(?:\r?\n)+/, ""),
    sampleInput: extractFenced(content, "Sample Input"),
    sampleOutput: extractFenced(content, "Sample Output"),
  };
}

/** All published challenges, newest first. */
export function getAllChallenges(): Challenge[] {
  let files: string[];
  try {
    files = fs.readdirSync(CHALLENGES_DIR);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".md"))
    .map(readChallengeFile)
    .filter((c): c is Challenge => c !== null)
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

/**
 * The Problem of the Day — the most recently dated published challenge.
 * Returns `null` when no challenge files exist yet.
 */
export function getDailyChallenge(): Challenge | null {
  return getAllChallenges()[0] ?? null;
}
