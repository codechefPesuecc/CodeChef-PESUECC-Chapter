import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseLargeBody } from "@/server/algohunt/http";
import { TEST_CHUNK_LIMITS, insertTestChunk } from "@/server/algohunt/import/challenges";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const CHUNK_MAX_BYTES = 5 * 1024 * 1024;

const bodySchema = z.object({
  startIdx: z.number().int().min(0).max(1000),
  tests: z.array(z.object({
    input: z.string(),
    output: z.string(),
    isSample: z.boolean(),
  }).strict()).min(1).max(TEST_CHUNK_LIMITS.maxRows),
}).strict();

/** POST /api/admin/algohunt/challenges/[challengeId]/tests: { startIdx, tests } (≤ 30 rows, ≤ 5 MB). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ challengeId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const parsed = await parseLargeBody(req, bodySchema, CHUNK_MAX_BYTES);
    if (!parsed.ok) return parsed.response;
    const { challengeId } = await params;
    const result = await insertTestChunk({ challengeId, ...parsed.data });
    if (!result.ok) return fail(result.code, result.message);
    return ok({ inserted: result.inserted });
  } catch (error) {
    console.error("[algohunt:import-tests]", error);
    return fail("INTERNAL");
  }
}
