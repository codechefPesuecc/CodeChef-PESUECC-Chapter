import { NextResponse } from "next/server";
import { getTeacherUser } from "@/server/auth/session";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

/**
 * Teacher endpoint to render Markdown for Monstr contest creation preview.
 * Same as /api/admin/preview but gated by teacher status.
 */
export async function POST(req: Request) {
  const teacher = await getTeacherUser();
  if (!teacher) {
    return NextResponse.json(
      { ok: false, error: "Teachers only." },
      { status: 403 },
    );
  }

  let body: { markdown?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  const html = await renderMarkdown(markdown);
  return NextResponse.json({ ok: true, html });
}
