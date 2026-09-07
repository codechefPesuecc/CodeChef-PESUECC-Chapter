import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { updateProfile } from "@/server/profile";
import { enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/profile — the signed-in user edits their own name / username / SRN / PRN.
 * Body: any subset of { name, username, srn, prn }. Email is not editable here (it is
 * tied to the OTP verification flow).
 *
 * No session re-issue is needed: getCurrentUser() re-reads the row on every request,
 * so an edit is live immediately. `sessionEpoch` stays reserved for password resets.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const limited = await enforceRateLimits([[`profile:${user.id}`, 10, 60_000]]);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const result = await updateProfile(user.id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
