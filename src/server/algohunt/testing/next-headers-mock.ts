// Tests can vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));
// Use setTeamCookie(), setSiteSessionCookie() and clearCookies() to control the jar.
import crypto from "node:crypto";
import { createSessionToken } from "@/server/auth/token";

const jar = new Map<string, string>();

export async function cookies() {
  return {
    get(name: string) {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      jar.set(name, value);
    },
    delete(name: string) {
      jar.delete(name);
    },
    getAll(name?: string) {
      return [...jar.entries()].filter(([key]) => !name || key === name)
        .map(([key, value]) => ({ name: key, value }));
    },
  };
}

export function setTeamCookie(teamId: string, epoch = 0): void {
  // Mirror createTeamToken here so mocking next/headers does not circularly
  // import teamSession while its own import of next/headers is still loading.
  const secret = process.env.AUTH_SECRET || "dev-insecure-change-me-in-production";
  const key = crypto.createHmac("sha256", secret).update("algohunt-team-cookie-v1").digest();
  const payload = `ahteam:v1:${teamId}:${epoch}:${Date.now() + 86_400_000}`;
  const signature = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  jar.set("ah_team", `${payload}.${signature}`);
}

export function setSiteSessionCookie(userId: string, epoch = 0): void {
  jar.set("arena_session", createSessionToken(userId, epoch));
}

export function clearCookies(): void {
  jar.clear();
}
