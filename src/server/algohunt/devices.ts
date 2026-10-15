import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import type { DeviceKind } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import { clientIp } from "@/server/rateLimit";
import type { TeamContext } from "./teamSession";

// Which browsers a team plays from. Track and alert only: nothing here ever blocks a login.

export const AH_DEVICE_COOKIE = "ah_device";
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
/** A poll refreshes lastSeenAt at most this often, so the 8 s state poller costs one write a minute. */
export const DEVICE_TOUCH_INTERVAL_MS = 60_000;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function deviceKind(headers: Headers): DeviceKind {
  if (headers.get("sec-ch-ua-mobile") === "?1") return "MOBILE";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(headers.get("user-agent") ?? "") ? "MOBILE" : "DESKTOP";
}

/** This browser's device id, or a new one. When isNew, the caller must setDeviceCookie on its response. */
export async function resolveDeviceId(): Promise<{ id: string; isNew: boolean }> {
  const value = (await cookies()).get(AH_DEVICE_COOKIE)?.value;
  if (value && DEVICE_ID_PATTERN.test(value)) return { id: value, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}

export function setDeviceCookie(response: NextResponse, id: string): void {
  response.cookies.set(AH_DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}

/**
 * Upsert the device row in one statement. A login always writes and is counted; a poll writes only
 * when the row is new or lastSeenAt is older than DEVICE_TOUCH_INTERVAL_MS.
 */
export async function recordDevice(p: {
  ctx: TeamContext;
  deviceId: string;
  req: Request;
  login?: boolean;
  now?: number;
}): Promise<void> {
  const now = p.now ?? Date.now();
  const ip = clientIp(p.req);
  const userAgent = p.req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const logins = p.login ? 1 : 0;
  await getDb().run(sql`
    INSERT INTO ah_team_devices
      (id, event_id, team_id, device_id, kind, user_agent, first_ip, last_ip, login_count, first_seen_at, last_seen_at)
    VALUES (${crypto.randomUUID()}, ${p.ctx.event.id}, ${p.ctx.team.id}, ${p.deviceId}, ${deviceKind(p.req.headers)},
      ${userAgent}, ${ip}, ${ip}, ${logins}, ${now}, ${now})
    ON CONFLICT (team_id, device_id) DO UPDATE SET
      kind = excluded.kind,
      user_agent = excluded.user_agent,
      last_ip = excluded.last_ip,
      last_seen_at = excluded.last_seen_at,
      login_count = login_count + ${logins}
    WHERE ${logins} = 1 OR last_seen_at < ${now - DEVICE_TOUCH_INTERVAL_MS}
  `);
}

/** Best effort: device tracking must never break a login or a poll. Returns the id to cookie, if new. */
export async function trackDevice(p: { ctx: TeamContext; req: Request; login?: boolean }): Promise<string | null> {
  try {
    const device = await resolveDeviceId();
    await recordDevice({ ctx: p.ctx, deviceId: device.id, req: p.req, login: p.login });
    return device.isNew ? device.id : null;
  } catch (error) {
    console.error("[algohunt:devices]", error);
    return null;
  }
}
