import { NextResponse } from "next/server";
import { resetPassword } from "@/server/auth/reset";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing reset token." },
      { status: 400 },
    );
  }

  const result = await resetPassword(token, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
