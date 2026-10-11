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
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(AH_TEAM_COOKIE);
    if (cookie?.value) {
      // If cookie exists (e.g. set by test/login)
      return {
        team: {
          id: "team-test-1",
          eventId: "evt-test-1",
          teamCode: "TST-T001",
          teamName: "Test Team Alpha",
          college: "PES University",
          passwordHash: "hash",
          sessionEpoch: 0,
          status: "CHECKED_IN",
          checkedInAt: Date.now() - 3600_000,
          finishedAt: null,
          disqualifiedAt: null,
          disqualificationReason: null,
          createdAt: Date.now() - 7200_000,
          updatedAt: Date.now() - 3600_000,
        },
        event: {
          id: "evt-test-1",
          slug: "algohunt-test",
          name: "AlgoHunt 2.0 (Live Test)",
          isTest: true,
          status: "LIVE",
          maxTeamSize: 4,
          rankingMode: "SOLVED_THEN_TIME",
          leaderboardVisible: true,
          submissionsEnabled: true,
          codesEnabled: true,
          startedAt: Date.now() - 1800_000,
          pausedAt: null,
          endedAt: null,
          createdAt: Date.now() - 7200_000,
          updatedAt: Date.now() - 1800_000,
        },
      };
    }

    // In local development, if no cookie is set, return a mock checked-in team session
    // so Module 2's workspace can be directly viewed and tested before Module 1 login lands.
    if (process.env.NODE_ENV === "development") {
      return {
        team: {
          id: "team-test-1",
          eventId: "evt-test-1",
          teamCode: "TST-T001",
          teamName: "Test Team Alpha",
          college: "PES University",
          passwordHash: "hash",
          sessionEpoch: 0,
          status: "CHECKED_IN",
          checkedInAt: Date.now() - 3600_000,
          finishedAt: null,
          disqualifiedAt: null,
          disqualificationReason: null,
          createdAt: Date.now() - 7200_000,
          updatedAt: Date.now() - 3600_000,
        },
        event: {
          id: "evt-test-1",
          slug: "algohunt-test",
          name: "AlgoHunt 2.0 (Live Test)",
          isTest: true,
          status: "LIVE",
          maxTeamSize: 4,
          rankingMode: "SOLVED_THEN_TIME",
          leaderboardVisible: true,
          submissionsEnabled: true,
          codesEnabled: true,
          startedAt: Date.now() - 1800_000,
          pausedAt: null,
          endedAt: null,
          createdAt: Date.now() - 7200_000,
          updatedAt: Date.now() - 1800_000,
        },
      };
    }

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
