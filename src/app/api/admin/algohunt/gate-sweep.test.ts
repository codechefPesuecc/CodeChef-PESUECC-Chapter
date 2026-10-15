process.env.DATABASE_URL = ":memory:";

// Every Module 5 route: a visitor, a site user who is not an admin, and a team cookie alone must all
// get 403 and change nothing. Add one row per route as the other Module 5 PRs land.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture, type Fixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie, setTeamCookie } from "@/server/algohunt/testing/next-headers-mock";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahEvents, ahStages, ahTeams } from "@/server/db/schema";
import { PATCH as patchEndTime } from "./events/[eventId]/end-time/route";
import { PATCH as patchFlags } from "./events/[eventId]/flags/route";
import { POST as postTransition } from "./events/[eventId]/transition/route";
import { GET as getOverview } from "./overview/route";
import { PATCH as patchStage } from "./stages/[stageId]/route";
import { GET as getTeams } from "./teams/route";
import { POST as postCheckinAll } from "./teams/checkin-all/route";
import { GET as getTeamDetail } from "./teams/[teamId]/route";
import { POST as postTeamCheckin } from "./teams/[teamId]/checkin/route";
import { POST as postDisqualify } from "./teams/[teamId]/disqualify/route";
import { POST as postOverride } from "./teams/[teamId]/override/route";
import { POST as postReinstate } from "./teams/[teamId]/reinstate/route";
import { POST as postResetPassword } from "./teams/[teamId]/reset-password/route";
import { GET as getTeamTimeline } from "./teams/[teamId]/timeline/route";

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
    name: "PATCH events/[eventId]/end-time",
    call: (f) => patchEndTime(
      jsonRequest("PATCH", "/x", { endsAt: Date.now() + 60_000, reason: "Gate sweep", confirm: f.event.slug }),
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
  {
    name: "GET overview",
    call: (f) => getOverview(jsonRequest("GET", `/x?event=${f.event.slug}`)),
  },
  {
    name: "GET teams",
    call: (f) => getTeams(jsonRequest("GET", `/x?event=${f.event.slug}`)),
  },
  {
    name: "POST teams/checkin-all",
    call: (f) => postCheckinAll(jsonRequest("POST", `/x?event=${f.event.slug}`, { confirm: f.event.slug })),
  },
  {
    name: "GET teams/[teamId]",
    call: (f) => getTeamDetail(jsonRequest("GET", "/x"), { params: Promise.resolve({ teamId: f.teams[0].team.id }) }),
  },
  {
    name: "GET teams/[teamId]/timeline",
    call: (f) => getTeamTimeline(jsonRequest("GET", "/x"), { params: Promise.resolve({ teamId: f.teams[0].team.id }) }),
  },
  {
    name: "POST teams/[teamId]/override",
    call: (f) => postOverride(
      jsonRequest("POST", "/x", {
        action: "COMPLETE_STAGE", stageNumber: 1, reason: "Gate sweep", confirm: f.teams[0].team.teamCode,
      }),
      { params: Promise.resolve({ teamId: f.teams[0].team.id }) },
    ),
  },
  {
    name: "POST teams/[teamId]/disqualify",
    call: (f) => postDisqualify(
      jsonRequest("POST", "/x", { reason: "Gate sweep", confirm: f.teams[0].team.teamCode }),
      { params: Promise.resolve({ teamId: f.teams[0].team.id }) },
    ),
  },
  {
    name: "POST teams/[teamId]/reinstate",
    call: (f) => postReinstate(
      jsonRequest("POST", "/x", { reason: "Gate sweep", confirm: f.teams[0].team.teamCode }),
      { params: Promise.resolve({ teamId: f.teams[0].team.id }) },
    ),
  },
  {
    name: "POST teams/[teamId]/reset-password",
    call: (f) => postResetPassword(
      jsonRequest("POST", "/x", { confirm: f.teams[0].team.teamCode }),
      { params: Promise.resolve({ teamId: f.teams[0].team.id }) },
    ),
  },
  {
    name: "POST teams/[teamId]/checkin",
    call: (f) => postTeamCheckin(jsonRequest("POST", "/x"), { params: Promise.resolve({ teamId: f.teams[0].team.id }) }),
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
        expect(event).toMatchObject({ status: "LIVE", codesEnabled: true, endsAt: null });
        const [stage] = await getDb().select().from(ahStages).where(eq(ahStages.id, fixture.stages[0].id));
        expect(stage.enabled).toBe(true);
        expect(await getDb().select().from(ahAuditLogs)).toHaveLength(0);
        const [team] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, fixture.teams[0].team.id));
        expect(team).toMatchObject({ status: "CHECKED_IN", passwordHash: fixture.teams[0].team.passwordHash });
      });
    }
  }
});
