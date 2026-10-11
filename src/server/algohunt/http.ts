/**
 * AlgoHunt HTTP helpers — local mock until Module 1 lands.
 * Module 1 owns the real implementation; this file is deleted when M1 merges.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { bodyTooLarge } from "@/server/limits";
import type { ErrorCode } from "@/lib/algohunt/types";

export { ErrorCode };

export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  COOLDOWN: 429,
  EVENT_NOT_LIVE: 403,
  EVENT_PAUSED: 403,
  EVENT_ENDED: 403,
  TEAM_NOT_CHECKED_IN: 403,
  TEAM_DISQUALIFIED: 403,
  TEAM_FINISHED: 403,
  STAGE_LOCKED: 403,
  STAGE_DISABLED: 403,
  ALREADY_SOLVED: 409,
  CHALLENGE_NOT_SOLVED: 403,
  SUBMISSIONS_DISABLED: 403,
  CODES_DISABLED: 403,
  UNSUPPORTED_LANGUAGE: 400,
  PAYLOAD_TOO_LARGE: 413,
  JUDGE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** Standard success response: { ok: true, ...data } */
export function ok<T extends object>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, ...data }, init);
}

/** Standard error response: { ok: false, error, code, ...extra } */
export function fail(
  code: ErrorCode,
  message?: string,
  extra?: Record<string, unknown>,
): NextResponse {
  const status = ERROR_STATUS[code] ?? 403;
  const body: Record<string, unknown> = {
    ok: false,
    error: message ?? `Error: ${code}`,
    code,
    ...extra,
  };
  const init: ResponseInit = { status };
  if (code === "RATE_LIMITED" || code === "COOLDOWN") {
    const retryAfterSeconds = (extra?.retryAfterSeconds as number | undefined) ?? 60;
    (init as Record<string, unknown>).headers = { "Retry-After": String(retryAfterSeconds) };
  }
  return NextResponse.json(body, init);
}

/** Parse and validate a JSON request body with a zod schema. */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  // CSRF: check origin
  const originCheck = checkOrigin(req);
  if (originCheck) return { ok: false, response: originCheck };

  // Content-Length gate
  const tooLarge = bodyTooLarge(req);
  if (tooLarge) return { ok: false, response: tooLarge };

  // Content-Type must be JSON
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return { ok: false, response: fail("VALIDATION", "Content-Type must be application/json.") };
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail("VALIDATION", "Invalid JSON body.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { ok: false, response: fail("VALIDATION", msg) };
  }

  return { ok: true, data: parsed.data as z.infer<S> };
}

/**
 * CSRF origin check. If Origin header is present and its host ≠ request host → FORBIDDEN.
 */
export function checkOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  try {
    const originHost = new URL(origin).host;
    const reqUrl = req.url;
    if (!reqUrl) return null;
    const reqHost = new URL(reqUrl).host;
    if (originHost !== reqHost) {
      return fail("FORBIDDEN", "Cross-origin request rejected.");
    }
  } catch {
    // Malformed origin or URL — be restrictive
    return fail("FORBIDDEN", "Could not verify request origin.");
  }
  return null;
}
