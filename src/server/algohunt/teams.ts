import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { ahAuditLogs, ahTeamMembers, ahTeams, type AhTeamMember } from "@/server/db/schema";
import { getEventById, getTeamCodePrefix } from "./events";
import type { ErrorCode } from "@/lib/algohunt/types";

/**
 * AlgoHunt 2.0 — Team Roster Import and Management.
 *
 * Implements §5.3 of Platform_06_Raj_Data_Import_and_QA.md.
 *
 * Handles CSV/XLSX roster parsing, friendly password generation,
 * PBKDF2 password hashing (100k iterations), and chunked insertion (<= 10 teams/chunk)
 * to respect Cloudflare Workers CPU time limits.
 */

export const MAX_TEAMS_PER_IMPORT_CHUNK = 10;

export interface RosterMemberInput {
  name: string;
  email?: string;
  phone?: string;
  isCaptain?: boolean;
}

export interface ParsedTeamRow {
  teamName: string;
  college?: string;
  teamCode?: string; // Optional custom team code from CSV, else generated
  members: RosterMemberInput[];
}

export interface ImportedTeamRecord {
  id: string;
  teamCode: string;
  teamName: string;
  college: string | null;
  plainPassword: string; // ONLY returned at import time for credential slips/export
  members: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isCaptain: boolean;
  }>;
}

const PASSWORD_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * Generates an 8-character human-friendly random password.
 * Avoids visually ambiguous characters (0/O, 1/l/I).
 */
export function generateTeamPassword(): string {
  const bytes = crypto.randomBytes(8);
  let res = "";
  for (let i = 0; i < 8; i++) {
    res += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return res;
}

/**
 * Normalizes an object's keys by lowercasing and stripping non-alphanumeric chars.
 */
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses a CSV or XLSX buffer into structured team inputs.
 */
export function parseRosterFile(buffer: Buffer | ArrayBuffer): ParsedTeamRow[] {
  const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const workbook = XLSX.read(nodeBuf, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const parsedTeams: ParsedTeamRow[] = [];

  for (const raw of rawRows) {
    const rowMap = new Map<string, string>();
    for (const [k, v] of Object.entries(raw)) {
      rowMap.set(normalizeKey(k), String(v).trim());
    }

    // Identify team name
    const teamName =
      rowMap.get("teamname") ||
      rowMap.get("team") ||
      rowMap.get("name") ||
      "";

    if (!teamName) continue; // Skip blank or header rows

    const college =
      rowMap.get("college") ||
      rowMap.get("institution") ||
      rowMap.get("collegename") ||
      undefined;

    const customTeamCode =
      rowMap.get("teamcode") ||
      rowMap.get("code") ||
      undefined;

    // Collect members (up to 4)
    const members: RosterMemberInput[] = [];

    // Helper to find member field
    const findMemberField = (num: number, field: string) => {
      if (field === "name") {
        const direct =
          rowMap.get(`member${num}`) ||
          rowMap.get(`player${num}`) ||
          rowMap.get(`p${num}`) ||
          rowMap.get(`m${num}`);
        if (direct) return direct;
      }
      return (
        rowMap.get(`member${num}${field}`) ||
        rowMap.get(`m${num}${field}`) ||
        rowMap.get(`player${num}${field}`) ||
        (num === 1 && field === "name" ? rowMap.get("captainname") || rowMap.get("captain") : "") ||
        (num === 1 && field === "email" ? rowMap.get("captainemail") : "") ||
        (num === 1 && field === "phone" ? rowMap.get("captainphone") : "") ||
        ""
      );
    };

    for (let num = 1; num <= 4; num++) {
      const name = findMemberField(num, "name");
      const email = findMemberField(num, "email");
      const phone = findMemberField(num, "phone");

      if (name) {
        members.push({
          name,
          email: email || undefined,
          phone: phone || undefined,
          isCaptain: num === 1,
        });
      }
    }

    // If no explicit members parsed, treat the first person / contact as member 1
    if (members.length === 0) {
      const fallbackName = rowMap.get("captain") || rowMap.get("contactname") || teamName;
      members.push({
        name: fallbackName,
        isCaptain: true,
      });
    }

    parsedTeams.push({
      teamName,
      college,
      teamCode: customTeamCode,
      members,
    });
  }

  return parsedTeams;
}

/**
 * Imports a chunk of teams (<= 10 teams per call) for a given event.
 * Hashes passwords with PBKDF2 (100,000 iterations).
 * Returns the created teams with plain-text passwords for credentials distribution.
 */
export async function importTeamsChunk(params: {
  eventId: string;
  teams: ParsedTeamRow[];
  startingIndex?: number;
  actorId?: string;
}): Promise<
  | { ok: true; imported: ImportedTeamRecord[]; nextIndex: number }
  | { ok: false; code: ErrorCode; message: string }
> {
  const { eventId, teams, actorId } = params;
  const db = getDb();

  const event = await getEventById(eventId);
  if (!event) {
    return { ok: false, code: "NOT_FOUND", message: "Event not found." };
  }

  if (teams.length === 0) {
    return { ok: true, imported: [], nextIndex: params.startingIndex ?? 1 };
  }

  if (teams.length > MAX_TEAMS_PER_IMPORT_CHUNK) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `Chunk size ${teams.length} exceeds max allowable ${MAX_TEAMS_PER_IMPORT_CHUNK} teams (Cloudflare Workers CPU limit).`,
    };
  }

  const prefix = getTeamCodePrefix(event);
  let currentIndex = params.startingIndex ?? 1;

  // Determine existing team count if startingIndex wasn't provided
  if (params.startingIndex === undefined) {
    const existingTeams = await db
      .select({ id: ahTeams.id })
      .from(ahTeams)
      .where(eq(ahTeams.eventId, eventId));
    currentIndex = existingTeams.length + 1;
  }

  const now = Date.now();
  const importedResults: ImportedTeamRecord[] = [];

  for (const teamInput of teams) {
    const teamId = crypto.randomUUID();
    const plainPassword = generateTeamPassword();
    const passwordHash = await hashPassword(plainPassword);

    // Format team code (e.g. AH2-001, TST-001) or use specified
    const teamCode =
      teamInput.teamCode?.trim() ||
      `${prefix}-${String(currentIndex).padStart(3, "0")}`;
    currentIndex++;

    // Insert team
    await db.insert(ahTeams).values({
      id: teamId,
      eventId,
      teamCode,
      teamName: teamInput.teamName,
      college: teamInput.college ?? null,
      passwordHash,
      sessionEpoch: 0,
      status: "REGISTERED",
      createdAt: now,
      updatedAt: now,
    });

    // Insert team members
    const memberRecords: ImportedTeamRecord["members"] = [];
    for (let i = 0; i < teamInput.members.length; i++) {
      const m = teamInput.members[i];
      const memberId = crypto.randomUUID();
      const isCaptain = m.isCaptain ?? i === 0;

      await db.insert(ahTeamMembers).values({
        id: memberId,
        teamId,
        name: m.name,
        email: m.email ?? null,
        phone: m.phone ?? null,
        isCaptain,
        createdAt: now,
      });

      memberRecords.push({
        id: memberId,
        name: m.name,
        email: m.email ?? null,
        phone: m.phone ?? null,
        isCaptain,
      });
    }

    importedResults.push({
      id: teamId,
      teamCode,
      teamName: teamInput.teamName,
      college: teamInput.college ?? null,
      plainPassword,
      members: memberRecords,
    });
  }

  if (actorId) {
    await db.insert(ahAuditLogs).values({
      id: crypto.randomUUID(),
      eventId,
      teamId: null,
      actorType: "ADMIN",
      actorId,
      action: "import.teams",
      targetType: "event",
      targetId: eventId,
      metadata: JSON.stringify({
        count: importedResults.length,
        teamCodes: importedResults.map((t) => t.teamCode),
      }),
      ip: null,
      userAgent: null,
      createdAt: now,
    });
  }

  return { ok: true, imported: importedResults, nextIndex: currentIndex };
}

/**
 * Returns credentials and roster data for all teams in an event (for printing credential slips).
 */
export async function getEventTeamsForCredentials(eventId: string) {
  const db = getDb();
  const teams = await db
    .select({
      id: ahTeams.id,
      teamCode: ahTeams.teamCode,
      teamName: ahTeams.teamName,
      college: ahTeams.college,
      status: ahTeams.status,
    })
    .from(ahTeams)
    .where(eq(ahTeams.eventId, eventId))
    .orderBy(ahTeams.teamCode);

  const members = await db
    .select()
    .from(ahTeamMembers)
    .where(
      sql`${ahTeamMembers.teamId} IN (SELECT id FROM ah_teams WHERE event_id = ${eventId})`
    );

  const membersByTeam = new Map<string, AhTeamMember[]>();
  for (const m of members) {
    const list = membersByTeam.get(m.teamId) ?? [];
    list.push(m);
    membersByTeam.set(m.teamId, list);
  }

  return teams.map((t) => ({
    ...t,
    members: membersByTeam.get(t.id) ?? [],
  }));
}
