import { NextRequest } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { seedTestEvent } from "@/server/algohunt/seed-test";
import { fail, ok } from "@/server/algohunt/http";
import type { EventStatus } from "@/lib/algohunt/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return fail("UNAUTHENTICATED", "Admin authentication required.");

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const p = (body ?? {}) as {
    slug?: string;
    name?: string;
    reset?: boolean;
    eventStatus?: EventStatus;
  };

  try {
    const result = await seedTestEvent({
      slug: p.slug,
      name: p.name,
      reset: p.reset ?? true,
      eventStatus: p.eventStatus ?? "READY",
    });

    return ok({
      event: result.event,
      stagesCount: result.stages.length,
      teamsCount: result.teams.length,
      codeBatchesCount: result.codeBatches.length,
    });
  } catch (err) {
    return fail("INTERNAL", (err as Error).message);
  }
}
