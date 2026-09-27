import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getRecruitmentSettings } from "@/server/recruitment";
import {
  getUserApplication,
  submitOrUpdateApplication,
} from "@/server/recruitment-applications";
import { clientIp, enforceRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const settings = await getRecruitmentSettings();
  const cycle = settings.cycle?.trim() || "current";

  const application = await getUserApplication(user.id, cycle);
  return NextResponse.json({ ok: true, application });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  if (process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !user.emailVerified) {
    return NextResponse.json(
      { ok: false, error: "Please verify your email address before applying." },
      { status: 403 },
    );
  }

  const limited = await enforceRateLimits([
    [`recruitment:user:${user.id}`, 20, 60 * 1000],
    [`recruitment:ip:${clientIp(req)}`, 40, 60 * 1000],
  ]);
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const result = await submitOrUpdateApplication(user.id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, application: result.application });
}
