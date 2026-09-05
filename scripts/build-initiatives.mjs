import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { z } from "zod/v4";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_ROOT = path.join(ROOT, "content", "initiatives");
const OUT = path.join(ROOT, "src", "app", "initiatives", "initiatives.manifest.json");

// ════════════════════════════════════════════════════════════════
// Security: Safe URL Schema
// ════════════════════════════════════════════════════════════════

const SafeUrlSchema = z.string().refine(
  (val) => {
    if (!val || val === "#" || val.startsWith("/") || val.startsWith("#")) return true;
    try {
      const parsed = new URL(val);
      return ["http:", "https:", "mailto:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  },
  { message: "Must be a valid safe URL (http, https, mailto, or relative path)" }
);

// ════════════════════════════════════════════════════════════════
// Helper: Clean Markdown to Plain-Text Excerpt
// ════════════════════════════════════════════════════════════════

function stripMarkdown(text, maxLength = 260) {
  if (!text) return "";
  const cleaned = text
    .replace(/^#+\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).replace(/\s+\S*$/, "") + "...";
}

// ════════════════════════════════════════════════════════════════
// Zod Validation Schemas
// ════════════════════════════════════════════════════════════════

const TimelineStatSchema = z.object({
  label: z.coerce.string(),
  value: z.coerce.string(),
});

const TimelineEntrySchema = z.object({
  date: z.coerce.string(),
  title: z.string().min(1, "Timeline entry title is required"),
  tag: z.coerce.string().default("Milestone"),
  description: z.string().default(""),
  image: z.string().optional(),
  stats: z.array(TimelineStatSchema).optional().default([]),
  features: z.array(z.string()).optional().default([]),
});

const MentorSchema = z.object({
  name: z.string().min(1, "Mentor name is required"),
  role: z.string().default("Contributor"),
  photo: z.string().default("/dev-team.jpg"),
  linkedin: SafeUrlSchema.default("#"),
});

const WinnerMemberSchema = z.object({
  name: z.string().min(1, "Member name is required"),
  linkedin: SafeUrlSchema.optional(),
});

const WinnerSchema = z.object({
  team: z.string().min(1, "Team name is required"),
  achievement: z.string().default("Podium Finisher"),
  heroImage: z.string().default("/dev-team.jpg"),
  members: z.array(WinnerMemberSchema).default([]),
  experience: z.string().default(""),
});

const GalleryImageSchema = z.object({
  src: z.string().default("/dev-team.jpg"),
  caption: z.string().default(""),
});

const EventFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().default("Event"),
  status: z.string().default("Upcoming"),
  cadence: z.string().default(""),
  description: z.string().default(""),
  highlights: z.array(z.string()).optional().default([]),
  accent: z.coerce.string().default("01"),
  image: z.string().default("/dev-team.jpg"),
  gallery: z.array(GalleryImageSchema).optional().default([]),
  href: SafeUrlSchema.optional(),
  ctaLabel: z.string().optional(),
  brief: z.string().optional(),
  timeline: z.array(TimelineEntrySchema).optional().default([]),
  mentors: z.array(MentorSchema).optional().default([]),
  winners: z.array(WinnerSchema).optional().default([]),
});

const SystemFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: z.string().default(""),
  description: z.string().default(""),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional().default([]),
  pipeline: z.array(z.string()).optional().default([]),
  terminal: z.array(z.string()).optional().default([]),
});

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
    const filePath = path.join(eventsDir, file);
    const fallbackId = file.replace(/\.md$/, "");

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(raw);

      const dataWithFallback = {
        id: data.id || fallbackId,
        ...data,
      };

      const result = EventFrontmatterSchema.safeParse(dataWithFallback);
      if (!result.success) {
        console.error(
          `[initiatives] ⚠️ Validation failed for ${file}:\n` +
            result.error.issues
              .map((issue) => `  → ${issue.path.join(".")}: ${issue.message}`)
              .join("\n")
        );
        continue;
      }

      const validated = result.data;
      const bodyText = content.trim();

      events.push({
        ...validated,
        href: validated.href ?? `/initiatives/${validated.id}`,
        cardBrief: validated.brief || stripMarkdown(bodyText) || validated.description,
        detailedExplanation: bodyText,
      });
    } catch (err) {
      console.error(`[initiatives] ⚠️ Error reading ${file}: ${err?.message || err}`);
    }
  }

  // Sort events by accent (01, 02, etc.) to maintain order
  events.sort((a, b) => (a.accent || "").localeCompare(b.accent || ""));

  const systems = [];
  for (const file of readdirSafe(systemsDir)) {
    const filePath = path.join(systemsDir, file);
    const fallbackId = file.replace(/\.md$/, "");

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const { data } = matter(raw);

      const dataWithFallback = {
        id: data.id || fallbackId,
        ...data,
      };

      const result = SystemFrontmatterSchema.safeParse(dataWithFallback);
      if (!result.success) {
        console.error(
          `[initiatives] ⚠️ Validation failed for ${file}:\n` +
            result.error.issues
              .map((issue) => `  → ${issue.path.join(".")}: ${issue.message}`)
              .join("\n")
        );
        continue;
      }

      systems.push(result.data);
    } catch (err) {
      console.error(`[initiatives] ⚠️ Error reading ${file}: ${err?.message || err}`);
    }
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
