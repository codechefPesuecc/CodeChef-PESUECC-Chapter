import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { COPY } from "@/lib/algohunt/copy";
import type { ErrorCode, TeamStatus } from "@/lib/algohunt/types";
import { getDb } from "@/server/db";
import {
  ahAuditLogs,
  ahEvents,
  ahTeamMembers,
  ahTeams,
} from "@/server/db/schema";
import { auditInsert } from "./audit";

export interface CheckInResult {
  ok: true;
  alreadyCheckedIn: boolean;
  team: {
    code: string;
    name: string;
    college: string | null;
    status: TeamStatus;
    checkedInAt: number;
  };
}

export async function checkInTeam(p: {
  eventId: string;
  teamCode: string;
  actorType: "ADMIN" | "VOLUNTEER";
  actorId: string;
}): Promise<CheckInResult | { ok: false; code: ErrorCode; message: string }> {
  const db = getDb();
  const now = Date.now();
  const code = p.teamCode.trim().toUpperCase();

  // 1. Event status check
  const [event] = await db
    .select({ id: ahEvents.id, status: ahEvents.status })
    .from(ahEvents)
    .where(eq(ahEvents.id, p.eventId))
    .limit(1);

  if (!event) {
    return { ok: false, code: "NOT_FOUND", message: COPY.errors.NOT_FOUND };
  }
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return { ok: false, code: "EVENT_ENDED", message: COPY.errors.EVENT_ENDED };
  }

  // 2. Find team by code in event
  const [team] = await db
    .select()
    .from(ahTeams)
    .where(and(eq(ahTeams.eventId, p.eventId), eq(ahTeams.teamCode, code)))
    .limit(1);

  if (!team) {
    return { ok: false, code: "NOT_FOUND", message: "Team not found." };
  }

  // 3. Disqualified check
  if (team.status === "DISQUALIFIED") {
    return {
      ok: false,
      code: "TEAM_DISQUALIFIED",
      message: "This team has been disqualified from AlgoHunt 2.0.",
    };
  }

  // 4. Already CHECKED_IN or FINISHED
  if (team.status === "CHECKED_IN" || team.status === "FINISHED") {
    return {
      ok: true,
      alreadyCheckedIn: true,
      team: {
        code: team.teamCode,
        name: team.teamName,
        college: team.college ?? null,
        status: team.status as TeamStatus,
        checkedInAt: team.checkedInAt ?? now,
      },
    };
  }

  // 5. Update REGISTERED -> CHECKED_IN and write audit
  const [updated] = await db
    .update(ahTeams)
    .set({
      status: "CHECKED_IN",
      checkedInAt: now,
      updatedAt: now,
    })
    .where(and(eq(ahTeams.id, team.id), eq(ahTeams.status, "REGISTERED")))
    .returning({ id: ahTeams.id });

  if (!updated) {
    // Raced with another check-in
    const [refetched] = await db.select().from(ahTeams).where(eq(ahTeams.id, team.id)).limit(1);
    return {
      ok: true,
      alreadyCheckedIn: true,
      team: {
        code: team.teamCode,
        name: team.teamName,
        college: team.college ?? null,
        status: (refetched?.status ?? "CHECKED_IN") as TeamStatus,
        checkedInAt: refetched?.checkedInAt ?? now,
      },
    };
  }

  await auditInsert(db, {
    eventId: p.eventId,
    teamId: team.id,
    actorType: p.actorType,
    actorId: p.actorId,
    action: "team.checked_in",
    targetType: "team",
    targetId: team.id,
    metadata: {},
  });

  return {
    ok: true,
    alreadyCheckedIn: false,
    team: {
      code: team.teamCode,
      name: team.teamName,
      college: team.college ?? null,
      status: "CHECKED_IN",
      checkedInAt: now,
    },
  };
}

export async function checkInAllTeams(p: {
  eventId: string;
  actorId: string;
}): Promise<{ count: number }> {
  const db = getDb();
  const now = Date.now();

  const updatedTeams = await db
    .update(ahTeams)
    .set({
      status: "CHECKED_IN",
      checkedInAt: now,
      updatedAt: now,
    })
    .where(and(eq(ahTeams.eventId, p.eventId), eq(ahTeams.status, "REGISTERED")))
    .returning({ id: ahTeams.id, eventId: ahTeams.eventId });

  if (updatedTeams.length === 0) {
    return { count: 0 };
  }

  const auditRows = updatedTeams.map((t) => ({
    id: crypto.randomUUID(),
    eventId: t.eventId,
    teamId: t.id,
    actorType: "ADMIN" as const,
    actorId: p.actorId,
    action: "team.checked_in",
    targetType: "team",
    targetId: t.id,
    metadata: JSON.stringify({ bulk: true }),
    createdAt: now,
  }));

  const CHUNK_SIZE = 14;
  for (let i = 0; i < auditRows.length; i += CHUNK_SIZE) {
    await db.insert(ahAuditLogs).values(auditRows.slice(i, i + CHUNK_SIZE));
  }

  return { count: updatedTeams.length };
}

export async function getTeamForCheckin(
  eventId: string,
  rawCode: string
): Promise<{
  team: {
    code: string;
    name: string;
    college: string | null;
    status: TeamStatus;
    checkedInAt: number | null;
    members: string[];
  };
} | null> {
  const db = getDb();
  const code = rawCode.trim().toUpperCase();

  const [team] = await db
    .select()
    .from(ahTeams)
    .where(and(eq(ahTeams.eventId, eventId), eq(ahTeams.teamCode, code)))
    .limit(1);

  if (!team) return null;

  const memberRows = await db
    .select({ name: ahTeamMembers.name })
    .from(ahTeamMembers)
    .where(eq(ahTeamMembers.teamId, team.id));

  return {
    team: {
      code: team.teamCode,
      name: team.teamName,
      college: team.college ?? null,
      status: team.status as TeamStatus,
      checkedInAt: team.checkedInAt ?? null,
      members: memberRows.map((m) => m.name),
    },
  };
}
