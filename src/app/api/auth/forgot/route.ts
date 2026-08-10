import { NextResponse } from "next/server";
import { createPasswordReset } from "@/server/auth/reset";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const limited = await enforceRateLimits([
    [`forgot:email:${email}`, 5, 60 * 60_000],
    [`forgot:ip:${clientIp(req)}`, 40, 60 * 60_000],
  ]);
  if (limited) return limited;

  const origin = new URL(req.url).origin;
  const result = await createPasswordReset(email, origin);
  // Always ok — never reveal whether the email is registered.
  return NextResponse.json({ ok: true, devLink: result.devLink });
}
