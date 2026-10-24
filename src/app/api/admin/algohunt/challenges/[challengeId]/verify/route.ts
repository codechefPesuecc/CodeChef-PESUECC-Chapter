import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { checkOrigin, fail, ok } from "@/server/algohunt/http";
import { verifyChallenge } from "@/server/algohunt/import/challenges";
import { getAdminUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { ahChallenges } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/** POST /api/admin/algohunt/challenges/[challengeId]/verify: run the reference on Akiro against every test. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ challengeId: string }> },
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) return fail("FORBIDDEN", "Admins only.");
    const originError = checkOrigin(req);
    if (originError) return originError;
    const { challengeId } = await params;
    const [challenge] = await getDb().select().from(ahChallenges).where(eq(ahChallenges.id, challengeId)).limit(1);
    if (!challenge) return fail("NOT_FOUND", "Question not found.");
    return ok({ report: await verifyChallenge({ challenge, adminId: admin.id }) });
  } catch (error) {
    console.error("[algohunt:verify-challenge]", error);
    return fail("INTERNAL");
  }
}
