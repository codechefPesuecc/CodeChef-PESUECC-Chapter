import type { EventStatus } from "./types";

/** Generated codes avoid look-alikes (no 0/O/1/I/L/U). Imported codes may use any letter or digit. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // 30 chars
export const CODE_LENGTH = 8;

/** trim → uppercase → remove spaces, '-', '_' → slice(0, 32). */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_]/g, "").slice(0, 32);
}

/** exactly CODE_LENGTH chars, each A–Z or 0–9 (organizers can import their own codes). */
export function isWellFormedCode(normalized: string): boolean {
  return /^[A-Z0-9]+$/.test(normalized) && normalized.length === CODE_LENGTH;
}

/** crypto.getRandomValues + rejection sampling (accept b < 240). No Node imports: this file is shared with client components. */
export function generateCode(): string {
  let result = "";
  const buffer = new Uint8Array(16);
  while (result.length < CODE_LENGTH) {
    globalThis.crypto.getRandomValues(buffer);
    for (let i = 0; i < buffer.length && result.length < CODE_LENGTH; i++) {
      const b = buffer[i];
      if (b < 240) {
        result += CODE_ALPHABET[b % 30];
      }
    }
  }
  return result;
}

/** "7FQ2M8K3" → "7FQ2-M8K3" (display/print only; never stored with the dash). */
export function formatCodeForDisplay(code: string): string {
  if (code.length <= 4) {
    return code;
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Codes are scarce on purpose (fewer than teams need), so a short pool is normal. Admins only get a
 * calm heads-up while teams can play and almost no codes are left. Shared by the command center and Codes page.
 */
export const LOW_POOL_ACTIVE = 3;

export function isPoolLow(eventStatus: EventStatus, active: number): boolean {
  return (eventStatus === "LIVE" || eventStatus === "PAUSED") && active <= LOW_POOL_ACTIVE;
}
