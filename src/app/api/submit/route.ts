import { NextResponse } from "next/server";
import { judge } from "@/server/judge";

export const dynamic = "force-dynamic";

/**
 * Graded submission: runs the code against the problem's hidden tests in Piston
 * and returns the real verdict. Hidden test data never leaves the server — only
 * the verdict, pass count, and the failing test index. (Persisting to the DB and
 * updating the leaderboard is the next slice.)
 */
export async function POST(req: Request) {
  let body: { slug?: string; language?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { slug, language, code } = body;
  if (!slug || !language || typeof code !== "string") {
    return NextResponse.json(
      { ok: false, error: "slug, language and code are required." },
      { status: 400 },
    );
  }

  const result = await judge({ slug, language, code });

  if (result.verdict === "ERR") {
    return NextResponse.json({ ok: false, error: result.message ?? "Judge error." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, ...result });
}
