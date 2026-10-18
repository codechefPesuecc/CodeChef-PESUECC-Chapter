/**
 * Pure helpers for the Import page: splitting a question's tests into upload chunks, and turning a
 * registration spreadsheet (Google Form export) into roster rows.
 */

export interface TestRow {
  input: string;
  output: string;
  isSample: boolean;
}

/** Same caps as the server (TEST_CHUNK_LIMITS): ≤ 30 rows and ≤ 4M characters per upload. */
export const UPLOAD_MAX_ROWS = 30;
export const UPLOAD_MAX_CHARS = 4_000_000;

/** Samples first, then hidden tests, in upload chunks. Pure. */
export function chunkTests(
  samples: readonly { input: string; output: string }[],
  tests: readonly { input: string; output: string }[],
): { startIdx: number; tests: TestRow[] }[] {
  const rows: TestRow[] = [
    ...samples.map((s) => ({ input: s.input, output: s.output, isSample: true })),
    ...tests.map((t) => ({ input: t.input, output: t.output, isSample: false })),
  ];
  const chunks: { startIdx: number; tests: TestRow[] }[] = [];
  let current: TestRow[] = [];
  let chars = 0;
  let start = 0;
  rows.forEach((row, i) => {
    const size = row.input.length + row.output.length;
    if (current.length > 0 && (current.length >= UPLOAD_MAX_ROWS || chars + size > UPLOAD_MAX_CHARS)) {
      chunks.push({ startIdx: start, tests: current });
      current = [];
      chars = 0;
      start = i;
    }
    current.push(row);
    chars += size;
  });
  if (current.length > 0) chunks.push({ startIdx: start, tests: current });
  return chunks;
}

export interface RosterMember {
  name: string;
  email?: string;
  phone?: string;
  isCaptain?: boolean;
}

export interface RosterTeam {
  teamName: string;
  college?: string;
  members: RosterMember[];
}

export interface RosterMapping {
  teamName: string | null;
  college: string | null;
  /** One entry per member slot (1-based order); member 1 is the captain / team leader. */
  members: { name: string | null; email: string | null; phone: string | null }[];
}

function norm(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function find(headers: readonly string[], test: (h: string) => boolean): string | null {
  return headers.find((h) => test(norm(h))) ?? null;
}

function isMember(h: string, n: number): boolean {
  if (n === 1 && /\b(team leader|leader|captain)\b/.test(h)) return true;
  return new RegExp(`\\b(member|teammate|participant|player) ?${n}\\b`).test(h);
}

/**
 * Guess which column holds what, from header names. Built for the AlgoHunt registration form
 * ("Team Name", "Team Leader - Full Name", "Member 2 - Email Address", …) but tolerant of others.
 */
export function guessMapping(headers: readonly string[], maxTeamSize: number): RosterMapping {
  const members = Array.from({ length: maxTeamSize }, (_, i) => {
    const n = i + 1;
    return {
      name: find(headers, (h) => isMember(h, n) && /\bname\b/.test(h) && !/\bteam name\b/.test(h)),
      email: find(headers, (h) => isMember(h, n) && /\b(e ?mail|mail id)\b/.test(h)),
      phone: find(headers, (h) => isMember(h, n) && /\b(phone|mobile|whatsapp|contact number)\b/.test(h)),
    };
  });
  return {
    teamName: find(headers, (h) => /\bteam name\b/.test(h)) ?? find(headers, (h) => h === "team"),
    // The leader's "College & Campus" column, else any column about the college.
    college: find(headers, (h) => isMember(h, 1) && /\bcollege\b/.test(h) && !/\b(e ?mail|phone|number)\b/.test(h))
      ?? find(headers, (h) => /\b(college|institution|university)\b/.test(h) && !/\bemail\b/.test(h)),
    members,
  };
}

function cell(row: Record<string, unknown>, column: string | null): string {
  if (!column) return "";
  const value = row[column];
  return value === undefined || value === null ? "" : String(value).trim();
}

/** Spreadsheet rows → roster teams with the mapping. Rows without a team name are dropped. Pure. */
export function mapRoster(rows: readonly Record<string, unknown>[], mapping: RosterMapping): { team: RosterTeam; sourceRow: number }[] {
  const out: { team: RosterTeam; sourceRow: number }[] = [];
  rows.forEach((row, i) => {
    const teamName = cell(row, mapping.teamName).replace(/\s+/g, " ");
    if (!teamName) return;
    const members: RosterMember[] = [];
    mapping.members.forEach((slot, slotIndex) => {
      const name = cell(row, slot.name).replace(/\s+/g, " ");
      if (!name) return;
      const email = cell(row, slot.email);
      const phone = cell(row, slot.phone);
      members.push({
        name,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        isCaptain: slotIndex === 0,
      });
    });
    const college = cell(row, mapping.college);
    // The spreadsheet's row number (header is row 1), so an organizer can find it.
    out.push({ team: { teamName, ...(college ? { college } : {}), members }, sourceRow: i + 2 });
  });
  return out;
}

/** "Row 3 (Team X): …" from the server → index 2 in the list that was sent. */
export function rowIndexOf(message: string): number | null {
  const match = /^Row (\d+)\b/.exec(message);
  return match ? Number(match[1]) - 1 : null;
}

export interface SavedCredential {
  teamName: string;
  teamCode: string;
  password: string;
}

/** Credentials live only in this browser tab (sessionStorage) until printed or downloaded. */
export function credentialsKey(eventSlug: string): string {
  return `algohunt-credentials:${eventSlug}`;
}

export function loadCredentials(eventSlug: string): SavedCredential[] {
  try {
    const raw = sessionStorage.getItem(credentialsKey(eventSlug));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((c): c is SavedCredential =>
        typeof c?.teamName === "string" && typeof c?.teamCode === "string" && typeof c?.password === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveCredentials(eventSlug: string, creds: readonly SavedCredential[]): void {
  try {
    const byCode = new Map(loadCredentials(eventSlug).map((c) => [c.teamCode, c]));
    for (const c of creds) byCode.set(c.teamCode, c);
    sessionStorage.setItem(credentialsKey(eventSlug), JSON.stringify([...byCode.values()]));
  } catch {
    // Storage blocked: the page still offers the XLSX download of what it has in memory.
  }
}

export function clearCredentials(eventSlug: string): void {
  try {
    sessionStorage.removeItem(credentialsKey(eventSlug));
  } catch {
    // Nothing stored.
  }
}

/** Credentials workbook rows: teamName, teamCode, password, loginUrl. */
export function credentialRows(creds: readonly SavedCredential[], origin: string): (string)[][] {
  return [
    ["Team name", "Team code", "Password", "Login URL"],
    ...creds.map((c) => [c.teamName, c.teamCode, c.password, `${origin}/algohunt/login`]),
  ];
}
