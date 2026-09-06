import manifestData from "@/app/initiatives/initiatives.manifest.json";

// ════════════════════════════════════════════════════════════════
// Types (Exported for UI components & consumers)
// ════════════════════════════════════════════════════════════════

export interface TimelineStat {
  label: string;
  value: string;
}

export interface TimelineEntry {
  date: string;
  title: string;
  tag: string;
  description: string;
  image?: string;
  stats?: TimelineStat[];
  features?: string[];
}

export interface Mentor {
  name: string;
  role: string;
  photo: string;
  linkedin: string;
}

export interface WinnerMember {
  name: string;
  linkedin?: string;
}

export interface Winner {
  team: string;
  achievement: string;
  track?: string;
  badge?: string;
  heroImage: string;
  members: WinnerMember[];
  experience: string;
}

export interface GalleryImage {
  src: string;
  caption: string;
}

export interface Event {
  id: string;
  title: string;
  category: string;
  status: string;
  cadence: string;
  description: string;
  highlights: string[];
  accent: string;
  image: string;
  gallery: GalleryImage[];
  href: string;
  ctaLabel?: string;
  brief?: string;
  cardBrief: string;
  timeline: TimelineEntry[];
  mentors: Mentor[];
  winners: Winner[];
  /** Raw markdown body — used on detail page for full HTML compilation */
  detailedExplanation: string;
}

export interface SystemMetric {
  label: string;
  value: string;
}

export interface System {
  id: string;
  title: string;
  role: string;
  description: string;
  metrics: SystemMetric[];
  pipeline: string[];
  terminal: string[];
}

interface InitiativesManifest {
  events: Event[];
  systems: System[];
}

// ════════════════════════════════════════════════════════════════
// Data Store
// Baked at build time by scripts/build-initiatives.mjs via next.config.ts.
// Guaranteed zero runtime filesystem dependency — works natively on
// Cloudflare Workers (Edge Runtime), Docker, Serverless, and Node.js.
// ════════════════════════════════════════════════════════════════

const manifest = manifestData as InitiativesManifest;

/**
 * Returns all validated events.
 * Safe for Cloudflare Workers (0 fs calls at runtime).
 */
export function getAllEvents(): Event[] {
  return manifest.events || [];
}

/**
 * Returns a single event by slug, or null if not found.
 */
export function getEventBySlug(slug: string): Event | null {
  return getAllEvents().find((e) => e.id === slug) ?? null;
}

/**
 * Returns all valid event slugs for generateStaticParams().
 */
export function getEventSlugs(): string[] {
  return getAllEvents().map((e) => e.id);
}

/**
 * Returns all validated systems.
 */
export function getAllSystems(): System[] {
  return manifest.systems || [];
}
