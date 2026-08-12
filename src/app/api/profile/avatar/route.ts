import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { rateLimit } from "@/server/rateLimit";
import { putAvatar, deleteAvatar, avatarsAvailable } from "@/server/avatars";

export const dynamic = "force-dynamic";

// The client crops/compresses to ~256px before upload, so this is generous.
const MAX_AVATAR_BYTES = 512 * 1024;
const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png"]);

/**
 * Store a new profile picture. The browser sends the already-resized image as
 * the raw request body (Content-Type: image/*). We put it in R2 under a unique
 * key and record that key on the user; the previous object is cleaned up.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Log in first.", needsAuth: true },
      { status: 401 },
    );
  }
  if (!avatarsAvailable()) {
    return NextResponse.json(
      { ok: false, error: "Avatar storage isn't configured yet." },
      { status: 503 },
    );
  }

  const limit = await rateLimit(`avatar:user:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads — slow down a moment.", rateLimited: true },
      { status: 429 },
    );
  }

  const contentType = (req.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { ok: false, error: "Upload a PNG, JPEG, or WebP image." },
      { status: 400 },
    );
  }

  const data = await req.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { ok: false, error: `Image too large (max ${Math.round(MAX_AVATAR_BYTES / 1024)} KB).` },
      { status: 413 },
    );
  }

  const ext =
    contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
  const key = `${user.id}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

  if (!(await putAvatar(key, data, contentType))) {
    return NextResponse.json({ ok: false, error: "Couldn't store the image." }, { status: 503 });
  }

  const db = getDb();
  try {
    await db.update(users).set({ avatar: key }).where(eq(users.id, user.id));
  } catch (e) {
    console.error("[avatar] db update failed:", e);
    await deleteAvatar(key); // don't orphan the object we just wrote
    return NextResponse.json({ ok: false, error: "Couldn't save the image." }, { status: 500 });
  }

  // Best-effort: remove the previous avatar object.
  if (user.avatar && user.avatar !== key) await deleteAvatar(user.avatar);

  return NextResponse.json({
    ok: true,
    avatar: key,
    url: `/api/avatars/${encodeURIComponent(key)}`,
  });
}
