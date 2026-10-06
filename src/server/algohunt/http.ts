import { NextResponse } from "next/server";
import { z } from "zod";
import { COPY } from "@/lib/algohunt/copy";
import type { ErrorCode } from "@/lib/algohunt/types";
import { bodyTooLarge } from "@/server/limits";

export type { ErrorCode } from "@/lib/algohunt/types";

export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EVENT_NOT_LIVE: 403,
  EVENT_PAUSED: 403,
  EVENT_ENDED: 403,
  TEAM_NOT_CHECKED_IN: 403,
  TEAM_DISQUALIFIED: 403,
  TEAM_FINISHED: 403,
  STAGE_LOCKED: 403,
  STAGE_DISABLED: 403,
  ALREADY_SOLVED: 403,
  CHALLENGE_NOT_SOLVED: 403,
  SUBMISSIONS_DISABLED: 403,
  CODES_DISABLED: 403,
  COOLDOWN: 429,
  UNSUPPORTED_LANGUAGE: 403,
  PAYLOAD_TOO_LARGE: 413,
  JUDGE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export function ok<T extends object>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(
  code: ErrorCode,
  message?: string,
  extra?: Record<string, unknown>,
): NextResponse {
  const retryAfterSeconds = extra?.retryAfterSeconds;
  const headers = new Headers();
  if (
    (code === "RATE_LIMITED" || code === "COOLDOWN") &&
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds)
  ) {
    headers.set("Retry-After", String(Math.max(1, Math.ceil(retryAfterSeconds))));
  }
  return NextResponse.json(
    { ok: false, error: message ?? COPY.errors[code], code, ...extra },
    { status: ERROR_STATUS[code], headers },
  );
}

export function checkOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).host === new URL(req.url).host) return null;
  } catch {
    // A malformed Origin cannot establish that this is a same-origin request.
  }
  return fail("FORBIDDEN", "Cross-site request blocked.");
}

/** Parse a JSON body. Callers must use a strict object schema to reject unknown fields. */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const originError = checkOrigin(req);
  if (originError) return { ok: false, response: originError };
  if (bodyTooLarge(req)) return { ok: false, response: fail("PAYLOAD_TOO_LARGE") };
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false, response: fail("VALIDATION", "Expected a JSON request body.") };
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: fail("VALIDATION", "Invalid JSON body.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.join(".");
    return {
      ok: false,
      response: fail("VALIDATION", `${path ? `${path}: ` : ""}${first.message}`),
    };
  }
  return { ok: true, data: parsed.data };
}
