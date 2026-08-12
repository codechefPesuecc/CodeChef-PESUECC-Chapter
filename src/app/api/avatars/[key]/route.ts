import { getAvatar } from "@/server/avatars";

export const dynamic = "force-dynamic";

/**
 * Serve an avatar image by its R2 object key. Keys are unique per upload, so the
 * object is immutable and can be cached hard (a new upload gets a new key/URL).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const obj = await getAvatar(decodeURIComponent(key));
  if (!obj) return new Response("Not found", { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
