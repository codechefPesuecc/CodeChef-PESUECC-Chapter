export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // 30 chars, no 0/O/1/I/L
export const CODE_LENGTH = 8;

/** trim → uppercase → remove spaces, '-', '_' → slice(0, 32). */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_]/g, "").slice(0, 32);
}

/** exactly CODE_LENGTH chars, all in CODE_ALPHABET. */
export function isWellFormedCode(normalized: string): boolean {
  if (normalized.length !== CODE_LENGTH) {
    return false;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (!CODE_ALPHABET.includes(normalized[i])) {
      return false;
    }
  }
  return true;
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
