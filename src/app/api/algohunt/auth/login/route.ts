import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { ahEvents, ahTeamDevices, ahTeams } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";
import { writeAudit } from "@/server/algohunt/audit";
import { deviceKind, recordDevice, resolveDeviceId, setDeviceCookie } from "@/server/algohunt/devices";
import { fail, ok, parseBody } from "@/server/algohunt/http";
import { AH_TEAM_COOKIE, createTeamToken, startTeamSession } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  teamCode: z.string().min(3).max(20),
  password: z.string().min(4).max(64),
}).strict();
const DUMMY_HASH = `pbkdf2$100000$${"0".repeat(32)}$${"0".repeat(64)}`;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const parsed = await parseBody(req, bodySchema);
    if (!parsed.ok) return parsed.response;
    const teamCode = parsed.data.teamCode.trim().toUpperCase().replace(/\s+/g, " ");
    const ip = clientIp(req);
    const limited = await enforceRateLimits([
      // The whole hall may log in from one public IP at 10:30, so the IP cap is a backstop only.
      [`ah:login:ip:${ip}`, 600, 600_000],
      [`ah:login:team:${teamCode}`, 10, 600_000],
    ]);
    if (limited) {
      const retryAfterSeconds = Number(limited.headers.get("Retry-After") ?? "1");
      const body = await limited.json() as { error?: string };
      return fail("RATE_LIMITED", body.error, { retryAfterSeconds });
    }

    const rows = await getDb().select({ team: ahTeams, event: ahEvents })
      .from(ahTeams)
      .innerJoin(ahEvents, eq(ahTeams.eventId, ahEvents.id))
      .where(and(eq(ahTeams.teamCode, teamCode), ne(ahEvents.status, "ARCHIVED")))
      .limit(2);

    if (rows.length > 1) {
      console.error("[algohunt:login] duplicate team code", teamCode);
      return fail("INTERNAL");
    }
    const row = rows[0];
    const passwordCheck = await verifyPassword(parsed.data.password, row?.team.passwordHash ?? DUMMY_HASH);
    if (!row || !passwordCheck.ok) {
      await writeAudit({
        eventId: row?.event.id ?? null,
        teamId: row?.team.id ?? null,
        actorType: "SYSTEM",
        actorId: null,
        action: "team.login_failed",
        metadata: { teamCode },
        ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
      return fail("UNAUTHENTICATED", "Wrong team code or password.");
    }

    // One laptop per team: this login signs out every other browser holding the team's cookie.
    const device = await resolveDeviceId();
    const session = await startTeamSession({ team: row.team, deviceId: device.id });
    const response = ok({
      team: { code: row.team.teamCode, name: row.team.teamName },
      event: { name: row.event.name, status: row.event.status },
    });
    response.cookies.set(AH_TEAM_COOKIE, createTeamToken(row.team.id, session.epoch), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    if (device.isNew) setDeviceCookie(response, device.id);
    try {
      await recordDevice({ ctx: row, deviceId: device.id, req, login: true });
    } catch (error) {
      console.error("[algohunt:devices]", error); // device tracking must never break a login
    }
    const userAgent = req.headers.get("user-agent") ?? undefined;
    await writeAudit({
      eventId: row.event.id,
      teamId: row.team.id,
      actorType: "TEAM",
      actorId: row.team.id,
      action: "team.login",
      ip,
      userAgent,
    });
    if (session.replacedDeviceId) {
      await auditTakeover({ teamId: row.team.id, eventId: row.event.id, fromDeviceId: session.replacedDeviceId, req, ip });
    }
    return response;
  } catch (error) {
    console.error("[algohunt:login]", error);
    return fail("INTERNAL");
  }
}

/** The command center's "logged in on another laptop" alert. Best effort, like every login audit. */
async function auditTakeover(p: { teamId: string; eventId: string; fromDeviceId: string; req: Request; ip: string }) {
  try {
    const [previous] = await getDb().select({ kind: ahTeamDevices.kind }).from(ahTeamDevices)
      .where(and(eq(ahTeamDevices.teamId, p.teamId), eq(ahTeamDevices.deviceId, p.fromDeviceId)))
      .limit(1);
    await writeAudit({
      eventId: p.eventId,
      teamId: p.teamId,
      actorType: "TEAM",
      actorId: p.teamId,
      action: "team.session_takeover",
      metadata: { fromKind: previous?.kind ?? null, toKind: deviceKind(p.req.headers) },
      ip: p.ip,
      userAgent: p.req.headers.get("user-agent") ?? undefined,
    });
  } catch (error) {
    console.error("[algohunt:login] takeover audit", error);
  }
}
