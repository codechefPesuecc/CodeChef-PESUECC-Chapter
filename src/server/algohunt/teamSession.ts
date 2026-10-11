/**
 * AlgoHunt team session helpers — local mock until Module 1 lands.
 * Module 1 owns the real implementation; this stub is deleted when M1 merges.
 *
 * Real implementation: src/server/algohunt/teamSession.ts (M1)
 */
import { cookies } from "next/headers";
import type { AhTeam, AhEvent } from "@/lib/algohunt/_mock-db-types";
import { fail } from "./http";
import type { NextResponse } from "next/server";

export const AH_TEAM_COOKIE = "ah_team";

export interface TeamContext {
  team: AhTeam;
  event: AhEvent;
}

/**
 * Read the ah_team cookie and return the TeamContext if valid, else null.
 * TODO(M1): Replace with real implementation once Module 1 lands.
 */
export async function getCurrentTeam(): Promise<TeamContext | null> {
  // M1 stub: read cookie, verify signature, check sessionEpoch, event not ARCHIVED.
  // Until M1 lands, return null (no active session).
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(AH_TEAM_COOKIE);
    if (!cookie?.value) return null;
    // Real M1 implementation decodes and verifies a signed JWT here.
    // Stub: return null to indicate no valid session until M1 lands.
    return null;
  } catch {
    return null;
  }
}

/**
 * Like getCurrentTeam() but returns a UNAUTHENTICATED response if no session.
 * TODO(M1): Replace with real implementation once Module 1 lands.
 */
export async function requireTeam(): Promise<TeamContext | NextResponse> {
  const ctx = await getCurrentTeam();
  if (!ctx) return fail("UNAUTHENTICATED");
  return ctx;
}
