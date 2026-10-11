process.env.DATABASE_URL = ":memory:";

// Every Module 5 route: a visitor, a site user who is not an admin, and a team cookie alone must all
// get 403 and change nothing. Add one row per route as the other Module 5 PRs land.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture, type Fixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie, setTeamCookie } from "@/server/algohunt/testing/next-headers-mock";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents, ahStages } from "@/server/db/schema";
import { PATCH as patchFlags } from "./events/[eventId]/flags/route";
import { POST as postTransition } from "./events/[eventId]/transition/route";
import { PATCH as patchStage } from "./stages/[stageId]/route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

async function signInSiteUser(): Promise<{ id: string; username: string }> {
  const user = await createSiteUser({ isAdmin: false });
  setSiteSessionCookie(user.id);
  return user;
}

function jsonRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`https://chapter.example${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

interface RouteCase {
  name: string;
  call: (f: Fixture) => Promise<Response>;
}

const ROUTES: RouteCase[] = [
  {
    name: "POST events/[eventId]/transition",
    call: (f) => postTransition(
      jsonRequest("POST", "/x", { to: "PAUSED", confirm: f.event.slug }),
      { params: Promise.resolve({ eventId: f.event.id }) },
    ),
  },
  {
    name: "PATCH events/[eventId]/flags",
    call: (f) => patchFlags(
      jsonRequest("PATCH", "/x", { codesEnabled: false, reason: "Gate sweep", confirm: f.event.slug }),
      { params: Promise.resolve({ eventId: f.event.id }) },
    ),
  },
  {
    name: "PATCH stages/[stageId]",
    call: (f) => patchStage(
      jsonRequest("PATCH", "/x", { enabled: false, reason: "Gate sweep", confirm: f.event.slug }),
      { params: Promise.resolve({ stageId: f.stages[0].id }) },
    ),
  },
];

const VISITORS: { who: string; signIn: (f: Fixture) => Promise<unknown> | void }[] = [
  { who: "a visitor with no session", signIn: () => undefined },
  { who: "a site user who is not an admin", signIn: () => signInSiteUser() },
  { who: "a team cookie alone", signIn: (f) => setTeamCookie(f.teams[0].team.id) },
];

describe("admin gate sweep", () => {
  for (const route of ROUTES) {
    for (const visitor of VISITORS) {
      it(`${route.name} returns 403 for ${visitor.who} and changes nothing`, async () => {
        const fixture = await seedFixture();
        await visitor.signIn(fixture);
        const response = await route.call(fixture);
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ ok: false, code: "FORBIDDEN" });

        const [event] = await getDb().select().from(ahEvents).where(eq(ahEvents.id, fixture.event.id));
        expect(event).toMatchObject({ status: "LIVE", codesEnabled: true });
        const [stage] = await getDb().select().from(ahStages).where(eq(ahStages.id, fixture.stages[0].id));
        expect(stage.enabled).toBe(true);
        expect(await getDb().select().from(ahAuditLogs)).toHaveLength(0);
      });
    }
  }
});
