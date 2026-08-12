import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Storage for user profile pictures, backed by the R2 `AVATARS` bucket. Images
 * never touch D1 — the DB only holds the object key (`users.avatar`). Uploads are
 * small (the client crops/compresses to ~256px before sending), so proxying the
 * bytes through the Worker is cheap. Outside a Workers request scope (e.g. `next
 * dev` with no binding) these no-op, so the app still runs without R2.
 */

type Bucket = CloudflareEnv["AVATARS"] | null;

function bucket(): Bucket {
  try {
    return getCloudflareContext().env.AVATARS ?? null;
  } catch {
    return null;
  }
}

/** True when the R2 binding is present (i.e. running on Workers with the bucket). */
export function avatarsAvailable(): boolean {
  return bucket() !== null;
}

/** Store an avatar under `key`. Returns false if R2 isn't available. */
export async function putAvatar(
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<boolean> {
  const b = bucket();
  if (!b) return false;
  await b.put(key, data, { httpMetadata: { contentType } });
  return true;
}

/** Fetch an avatar's bytes + content type, or null if missing / no R2. */
export async function getAvatar(
  key: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  const b = bucket();
  if (!b) return null;
  const obj = await b.get(key);
  if (!obj) return null;
  return {
    body: obj.body as unknown as ReadableStream,
    contentType: obj.httpMetadata?.contentType ?? "image/webp",
  };
}

/** Best-effort delete of an old avatar (ignored if R2 is unavailable). */
export async function deleteAvatar(key: string): Promise<void> {
  const b = bucket();
  if (b) await b.delete(key).catch(() => {});
}

/** Public path the browser uses to load an avatar by its object key. */
export function avatarUrl(key: string | null | undefined): string | null {
  return key ? `/api/avatars/${encodeURIComponent(key)}` : null;
}
