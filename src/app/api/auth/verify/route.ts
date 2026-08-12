import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { verifyOtp } from "@/server/auth/verification";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in first.", needsAuth: true },
      { status: 401 },
    );
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // Route-level throttle on top of the per-OTP 5-attempt cap: blunts brute-force
  // guessing (and the DB writes each wrong guess makes), since a resend resets
  // the per-code counter.
  const limited = await enforceRateLimits([
    [`verify:user:${user.id}`, 10, 10 * 60_000],
    [`verify:ip:${clientIp(req)}`, 30, 10 * 60_000],
  ]);
  if (limited) return limited;

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const code = String(body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Enter the 6-digit code." },
      { status: 400 },
    );
  }

  const result = await verifyOtp(user.id, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
