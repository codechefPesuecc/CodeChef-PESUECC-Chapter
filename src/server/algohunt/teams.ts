import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { eq, inArray, like, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Roster checks before anything is stored (M6 brief §5.4). Errors block the import; warnings
 * don't. Row numbers are 1-based positions in `teams`. Pure.
 */
export function validateRoster(
  teams: readonly ParsedTeamRow[],
  ctx: {
    maxTeamSize: number;
    existingNames: ReadonlySet<string>;
    existingEmails: ReadonlySet<string>;
    existingPhones: ReadonlySet<string>;
  },
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const names = new Map<string, number>();
  const emails = new Map<string, number>();
  const phones = new Map<string, number>();

  teams.forEach((team, i) => {
    const row = i + 1;
    const label = `Row ${row}${team.teamName.trim() ? ` (${team.teamName.trim()})` : ""}`;
    const name = normalizeName(team.teamName);
    if (!name) errors.push(`Row ${row}: the team name is empty.`);
    else if (ctx.existingNames.has(name)) errors.push(`${label}: a team with this name is already in the event.`);
    else if (names.has(name)) errors.push(`${label}: same team name as row ${names.get(name)}.`);
    else names.set(name, row);

    if (team.members.length === 0) errors.push(`${label}: no members.`);
    if (team.members.length > ctx.maxTeamSize) {
      errors.push(`${label}: ${team.members.length} members, the limit is ${ctx.maxTeamSize}.`);
    }
    if (team.members.length > 0 && !team.members.some((m) => m.isCaptain)) {
      warnings.push(`${label}: no captain marked, so the first member becomes captain.`);
    }

    for (const member of team.members) {
      if (!member.name.trim()) errors.push(`${label}: a member has no name.`);
      const email = member.email?.trim().toLowerCase();
      if (email) {
        if (!EMAIL_PATTERN.test(email)) errors.push(`${label}: '${member.email}' is not an email address.`);
        else if (ctx.existingEmails.has(email)) errors.push(`${label}: ${email} is already on a team in this event.`);
        else if (emails.has(email) && emails.get(email) !== row) errors.push(`${label}: ${email} is also on row ${emails.get(email)}.`);
        else emails.set(email, row);
      }
      const phone = member.phone ? normalizePhone(member.phone) : "";
      if (phone) {
        if (ctx.existingPhones.has(phone)) errors.push(`${label}: phone ${member.phone} is already on a team in this event.`);
        else if (phones.has(phone) && phones.get(phone) !== row) errors.push(`${label}: phone ${member.phone} is also on row ${phones.get(phone)}.`);
        else phones.set(phone, row);
      } else if (member.name.trim()) {
        warnings.push(`${label}: ${member.name.trim()} has no phone number.`);
      }
    }
  });
  return { errors, warnings };
}

/** Names, emails and phones already in the event, normalised the way validateRoster compares them. */
export async function getRosterContext(eventId: string) {
  const db = getDb();
  const [teams, members] = await Promise.all([
    db.select({ name: ahTeams.teamName }).from(ahTeams).where(eq(ahTeams.eventId, eventId)),
    db.select({ email: ahTeamMembers.email, phone: ahTeamMembers.phone }).from(ahTeamMembers)
      .innerJoin(ahTeams, eq(ahTeamMembers.teamId, ahTeams.id))
      .where(eq(ahTeams.eventId, eventId)),
  ]);
  return {
    existingNames: new Set(teams.map((t) => normalizeName(t.name))),
    existingEmails: new Set(members.flatMap((m) => (m.email ? [m.email.trim().toLowerCase()] : []))),
    existingPhones: new Set(members.flatMap((m) => (m.phone ? [normalizePhone(m.phone)] : [])).filter(Boolean)),
  };
}

/**
 * The next free number for a team code prefix, across ALL events: login looks a team up by its
 * code alone, so two events must never share one.
 */
async function nextTeamNumber(prefix: string): Promise<number> {
  const rows = await getDb().select({ code: ahTeams.teamCode }).from(ahTeams)
    .where(like(ahTeams.teamCode, `${prefix}-%`));
  let max = 0;
  for (const { code } of rows) {
    const n = Number(code.slice(prefix.length + 1).replace(/^T/, ""));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Imports a chunk of teams (<= 10 per call, because PBKDF2 hashing is CPU-heavy on Workers).
 * Every team, member and the audit row go in one batch, so a chunk is all or nothing. Plaintext
 * passwords are returned once and never stored.
 */
export async function importTeamsChunk(params: {
  eventId: string;
  teams: ParsedTeamRow[];
  startingIndex?: number;
  actorId?: string;
  markCheckedIn?: boolean;
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
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return { ok: false, code: "CONFLICT", message: "The event has ended, so no more teams can be added." };
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

  const check = validateRoster(teams, { maxTeamSize: event.maxTeamSize, ...await getRosterContext(eventId) });
  if (check.errors.length > 0) return { ok: false, code: "VALIDATION", message: check.errors[0] };

  const prefix = getTeamCodePrefix(event);
  let currentIndex = params.startingIndex ?? await nextTeamNumber(prefix);
  const customCodes = teams.flatMap((t) => (t.teamCode?.trim() ? [t.teamCode.trim().toUpperCase()] : []));
  if (customCodes.length > 0) {
    const taken = await db.select({ code: ahTeams.teamCode }).from(ahTeams).where(inArray(ahTeams.teamCode, customCodes));
    if (taken.length > 0) return { ok: false, code: "CONFLICT", message: `Team code ${taken[0].code} is already in use.` };
  }

  const now = Date.now();
  const importedResults: ImportedTeamRecord[] = [];
  const statements: BatchItem<"sqlite">[] = [];

  for (const teamInput of teams) {
    const teamId = crypto.randomUUID();
    const plainPassword = generateTeamPassword();
    const passwordHash = await hashPassword(plainPassword);

    // AH2-001 on the real event, TST-001 / DRY-001 on test events (or the code given in the file).
    const teamCode =
      teamInput.teamCode?.trim().toUpperCase() ||
      `${prefix}-${String(currentIndex).padStart(3, "0")}`;
    currentIndex++;

    statements.push(db.insert(ahTeams).values({
      id: teamId,
      eventId,
      teamCode,
      teamName: teamInput.teamName.trim().replace(/\s+/g, " "),
      college: teamInput.college?.trim() || null,
      passwordHash,
      sessionEpoch: 0,
      status: params.markCheckedIn ? "CHECKED_IN" : "REGISTERED",
      checkedInAt: params.markCheckedIn ? now : null,
      createdAt: now,
      updatedAt: now,
    }));

    const hasCaptain = teamInput.members.some((m) => m.isCaptain);
    const memberRecords: ImportedTeamRecord["members"] = teamInput.members.map((m, i) => ({
      id: crypto.randomUUID(),
      name: m.name.trim(),
      email: m.email?.trim() || null,
      phone: m.phone?.trim() || null,
      isCaptain: hasCaptain ? Boolean(m.isCaptain) : i === 0,
    }));
    statements.push(db.insert(ahTeamMembers).values(memberRecords.map((m) => ({ ...m, teamId, createdAt: now }))));

    importedResults.push({
      id: teamId,
      teamCode,
      teamName: teamInput.teamName.trim().replace(/\s+/g, " "),
      college: teamInput.college?.trim() || null,
      plainPassword,
      members: memberRecords,
    });
  }

  statements.push(db.insert(ahAuditLogs).values({
    id: crypto.randomUUID(),
    eventId,
    teamId: null,
    actorType: "ADMIN",
    actorId: actorId ?? null,
    action: "import.teams",
    targetType: "event",
    targetId: eventId,
    metadata: JSON.stringify({
      count: importedResults.length,
      checkedIn: Boolean(params.markCheckedIn),
      teamCodes: importedResults.map((t) => t.teamCode),
    }),
    ip: null,
    userAgent: null,
    createdAt: now,
  }));

  const [first, ...rest] = statements;
  await db.batch([first, ...rest]);
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
