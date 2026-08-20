"use server";

import { cookies } from "next/headers";

export async function setConsentCookie(slug: string) {
  const cookieStore = await cookies();
  cookieStore.set(`arena-consent-${slug}`, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}
