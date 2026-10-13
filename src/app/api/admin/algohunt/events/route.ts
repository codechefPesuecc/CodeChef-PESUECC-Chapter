import { NextRequest } from "next/server";
import { getAdminUser } from "@/server/auth/session";
import { createEvent, listEvents } from "@/server/algohunt/events";
import { fail, ok } from "@/server/algohunt/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return fail("UNAUTHENTICATED", "Admin authentication required.");

  const events = await listEvents();
  return ok({ events });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return fail("UNAUTHENTICATED", "Admin authentication required.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "Invalid JSON payload.");
  }

  const p = (body ?? {}) as {
    name?: string;
    slug?: string;
    isTest?: boolean;
    maxTeamSize?: number;
    leaderboardVisible?: boolean;
    submissionsEnabled?: boolean;
    codesEnabled?: boolean;
  };

  if (!p.name || typeof p.name !== "string") {
    return fail("VALIDATION", "Event name is required.");
  }
  if (!p.slug || typeof p.slug !== "string") {
    return fail("VALIDATION", "Event slug is required.");
  }

  const result = await createEvent({
    name: p.name,
    slug: p.slug,
    isTest: p.isTest,
    maxTeamSize: p.maxTeamSize,
    leaderboardVisible: p.leaderboardVisible,
    submissionsEnabled: p.submissionsEnabled,
    codesEnabled: p.codesEnabled,
    actorId: admin.id,
  });

  if (!result.ok) {
    const code = result.code === "CONFLICT" ? "CONFLICT" : "VALIDATION";
    return fail(code, result.message);
  }

  return ok({ event: result.event });
}
