import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { createAndSendOtp } from "@/server/auth/verification";

export const dynamic = "force-dynamic";

export async function POST() {
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

  const result = await createAndSendOtp(user.id, user.email);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, cooldownMs: result.cooldownMs },
      { status: 429 },
    );
  }
  return NextResponse.json({ ok: true, devCode: result.devCode });
}
