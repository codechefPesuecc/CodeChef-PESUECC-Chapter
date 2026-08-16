import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

/** POST /api/admin/preview — render Markdown to the same sanitized HTML the stored
 * content uses, so the authoring form's preview matches the real solve page. Admins
 * only (it runs the Markdown pipeline). Body: { markdown: string }. */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
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
