import { NextResponse } from "next/server";

/**
 * Input-size limits for the code-execution endpoints (/api/run, /api/submit).
 * Untrusted request bodies are otherwise unbounded: without these a single
 * request could push hundreds of MB into the Worker's memory, a D1 row, and the
 * Judge Sandbox payload. The caps sit far above any real solution or test input.
 */

/** Max source-code length (chars). Real solutions are a few KB. */
export const MAX_CODE_CHARS = 64 * 1024;
/** Max stdin length (chars) for the Run endpoint's custom input. */
export const MAX_STDIN_CHARS = 64 * 1024;
/** Max serialized integrity-flags breakdown persisted per submission (chars). */
export const MAX_FLAGS_BREAKDOWN_CHARS = 8 * 1024;
/** Hard cap on the raw request body, read from Content-Length before we parse. */
export const MAX_BODY_BYTES = 256 * 1024;

/**
 * Rejects an over-large request up front using its declared Content-Length. The
 * header can be absent or understated, so this is a cheap first gate only —
 * callers must still bound each parsed field with `tooLong`. Returns a 413
 * response to send, or null to proceed.
 */
export function bodyTooLarge(req: Request): NextResponse | null {
  const len = Number(req.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Request body too large." },
      { status: 413 },
    );
  }
  return null;
}

/**
 * Returns a 413 response if `value` exceeds `max` chars, else null. `label`
 * names the field for the error message. Uses `.length` (O(1)) rather than
 * byte-encoding so an oversized input isn't fully encoded just to be rejected.
 */
export function tooLong(
  value: string,
  max: number,
  label: string,
): NextResponse | null {
  if (value.length > max) {
    return NextResponse.json(
      { ok: false, error: `${label} too large (max ${max} characters).` },
      { status: 413 },
    );
  }
  return null;
}
