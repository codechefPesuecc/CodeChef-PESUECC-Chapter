import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Match the flags the login/register routes set so the browser reliably
  // clears the same cookie (some browsers keep a cookie whose attributes differ).
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
