import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { attempts } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Server-authoritative integrity flags for the ranked Problem of the Day. The client
 * monitor (useIntegrityMonitor) reports each event here as it happens and accumulates
 * onto the user's `attempts` row, so the count survives a page refresh — and the
 * submission is scored against THIS total, not the resettable client payload.
 *
 * Only a ranked attempt has a row (created by /api/attempt/start for today's POTD),
 * so the UPDATE simply no-ops for past-problem practice.
 */

// Client integrity event → the JSON breakdown key (mirrors IntegrityCounts).
const EVENT_KEY: Record<string, string> = {
  paste: "paste",
  copy: "copy",
  cut: "cut",
  "tab-switch": "tabSwitch",
  "context-menu": "contextMenu",
  screenshot: "screenshot",
};

const ZERO = { paste: 0, copy: 0, cut: 0, tabSwitch: 0, contextMenu: 0, screenshot: 0 };
type Counts = typeof ZERO;

function parseCounts(json: string | null | undefined): Counts {
  if (!json) return { ...ZERO };
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && v >= 0 ? Math.round(v) : 0);
    return {
      paste: n(o.paste),
      copy: n(o.copy),
      cut: n(o.cut),
      tabSwitch: n(o.tabSwitch),
      contextMenu: n(o.contextMenu),
      screenshot: n(o.screenshot),
    };
  } catch {
    return { ...ZERO };
  }
}

async function readFlags(userId: string, slug: string) {
  const db = getDb();
  const rows = await db
    .select({ flags: attempts.flags, breakdown: attempts.flagsBreakdown })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.challengeSlug, slug)))
    .limit(1);
  const row = rows[0];
  return { total: row?.flags ?? 0, counts: parseCounts(row?.breakdown) };
}

/** GET /api/attempt/flag?slug= — the user's accumulated flags for a ranked attempt
 * (zeros if none). Seeds the client counter on load so a refresh shows the real count. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, needsAuth: true }, { status: 401 });
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug is required." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...(await readFlags(user.id, slug)) });
}

/** POST /api/attempt/flag {slug, event} — atomically increment the authoritative flag
 * count for the user's ranked attempt. No-ops if there's no attempt row. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, needsAuth: true }, { status: 401 });

  // Integrity events are sparse (coalesced client-side); this only bounds abuse.
  const limited = await enforceRateLimits([[`flag:user:${user.id}`, 240, 60_000]]);
  if (limited) return limited;

  let body: { slug?: string; event?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const key = EVENT_KEY[body.event ?? ""];
  if (!slug || !key) {
    return NextResponse.json(
      { ok: false, error: "slug and a valid event are required." },
      { status: 400 },
    );
  }

  const db = getDb();
  const path = `$.${key}`;
  await db
    .update(attempts)
    .set({
      flags: sql`${attempts.flags} + 1`,
      flagsBreakdown: sql`json_set(${attempts.flagsBreakdown}, ${path}, coalesce(json_extract(${attempts.flagsBreakdown}, ${path}), 0) + 1)`,
    })
    .where(and(eq(attempts.userId, user.id), eq(attempts.challengeSlug, slug)));

  return NextResponse.json({ ok: true, ...(await readFlags(user.id, slug)) });
}
