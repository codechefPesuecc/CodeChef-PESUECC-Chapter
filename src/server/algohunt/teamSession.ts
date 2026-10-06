import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahEvents, ahTeams, type AhEvent, type AhTeam } from "@/server/db/schema";
import { fail } from "./http";

export const AH_TEAM_COOKIE = "ah_team";
const TEAM_TOKEN_MAX_AGE = 24 * 60 * 60;
const DEV_FALLBACK_SECRET = "dev-insecure-change-me-in-production";
const TOKEN_PREFIX = "ahteam:v1:";
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export interface TeamContext {
  team: AhTeam;
  event: AhEvent;
}

function teamSecret(): Buffer {
  const configured = process.env.AUTH_SECRET;
  if ((!configured || configured === DEV_FALLBACK_SECRET) && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set in production (or is still the dev default).");
  }
  return crypto.createHmac("sha256", configured || DEV_FALLBACK_SECRET)
    .update("algohunt-team-cookie-v1").digest();
}

function signature(payload: string): Buffer {
  return crypto.createHmac("sha256", teamSecret()).update(payload).digest();
}

export function createTeamToken(teamId: string, epoch: number): string {
  const expiry = Date.now() + TEAM_TOKEN_MAX_AGE * 1000;
  const payload = `${TOKEN_PREFIX}${teamId}:${epoch}:${expiry}`;
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function readTeamToken(token: string): { teamId: string; epoch: number } | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  if (!payload.startsWith(TOKEN_PREFIX)) return null;
  const encodedSignature = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encodedSignature)) return null;
  const provided = Buffer.from(encodedSignature, "base64url");
  if (provided.toString("base64url") !== encodedSignature) return null;
  const expected = signature(payload);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  const parts = payload.split(":");
  if (parts.length !== 5 || parts[0] !== "ahteam" || parts[1] !== "v1") return null;
  const teamId = parts[2];
  const epoch = Number(parts[3]);
  const expiry = Number(parts[4]);
  if (!teamId || !Number.isSafeInteger(epoch) || epoch < 0 || !Number.isSafeInteger(expiry) || Date.now() >= expiry) {
    return null;
  }
  return { teamId, epoch };
}

export async function getCurrentTeam(): Promise<TeamContext | null> {
  const token = (await cookies()).get(AH_TEAM_COOKIE)?.value;
  const claims = token ? readTeamToken(token) : null;
  if (!claims) return null;
  const [row] = await getDb().select({ team: ahTeams, event: ahEvents })
    .from(ahTeams)
    .innerJoin(ahEvents, eq(ahTeams.eventId, ahEvents.id))
    .where(and(eq(ahTeams.id, claims.teamId), eq(ahTeams.sessionEpoch, claims.epoch)))
    .limit(1);
  if (!row || row.event.status === "ARCHIVED") return null;
  return row;
}

export async function requireTeam(): Promise<TeamContext | ReturnType<typeof fail>> {
  return (await getCurrentTeam()) ?? fail("UNAUTHENTICATED");
}

export function generateTeamPassword(): string {
  let result = "";
  while (result.length < 10) {
    for (const byte of crypto.randomBytes(10 - result.length)) {
      if (byte < 240) result += ALPHABET[byte % ALPHABET.length];
    }
  }
  return result;
}
