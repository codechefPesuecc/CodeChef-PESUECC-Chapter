process.env.DATABASE_URL = ":memory:";

/**
 * Security matrix (M6 brief §8): one test per row, each proven through the real route handlers.
 * Only the judge is mocked.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db";
import { ahTeams, ahTestCases } from "@/server/db/schema";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { seedFixture, type Fixture } from "./testing/fixtures";
import { clearCookies, cookies, setTeamCookie } from "./testing/next-headers-mock";

vi.mock("next/headers", () => import("./testing/next-headers-mock"));
vi.mock("@/server/judge", () => ({
  judgeTests: vi.fn(async (p: { code: string; tests: unknown[] }) => (p.code.includes("ACCEPT")
    ? { verdict: "AC", passed: p.tests.length, total: p.tests.length }
    : { verdict: "WA", passed: 0, total: p.tests.length, failedOn: 1 })),
}));

const { POST: submit, GET: listSubmissions } = await import("@/app/api/algohunt/submissions/route");
const { POST: redeem } = await import("@/app/api/algohunt/codes/redeem/route");
const { POST: run } = await import("@/app/api/algohunt/run/route");
const { POST: integrity } = await import("@/app/api/algohunt/integrity/route");
const { GET: currentChallenge } = await import("@/app/api/algohunt/challenges/current/route");
const stateRoute = await import("@/app/api/algohunt/state/route");
const leaderboardRoute = await import("@/app/api/algohunt/leaderboard/route");
const { GET: me } = await import("@/app/api/algohunt/auth/me/route");

const ORIGIN = "https://chapter.example";
const post = (path: string, body: unknown) => new Request(`${ORIGIN}${path}`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.9" },
  body: JSON.stringify(body),
});
const get = (path: string) => new Request(`${ORIGIN}${path}`);

let fixture: Fixture;
const as = (i: number) => setTeamCookie(fixture.teams[i].team.id, fixture.teams[i].team.sessionEpoch);
const submitCode = async (code: string) =>
  (await submit(post("/api/algohunt/submissions", { language: "cpp", code, clientRequestId: crypto.randomUUID() }))).json();

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
  fixture = await seedFixture({ stages: 3, teams: 2, codes: 6 });
});

describe("AlgoHunt security matrix (M6 brief §8)", () => {
  it("1. team A never sees team B's progress, and no participant POST accepts a teamId", async () => {
    as(1);
    await submitCode("ACCEPT");
    as(0);
    const state = JSON.stringify(await (await stateRoute.GET(get("/api/algohunt/state"))).json());
    expect(state).not.toContain(fixture.teams[1].team.id);
    expect(state).not.toContain(fixture.teams[1].team.teamCode);
    const teamId = fixture.teams[1].team.id;
    for (const res of [
      await submit(post("/api/algohunt/submissions", { language: "cpp", code: "x", clientRequestId: crypto.randomUUID(), teamId })),
      await redeem(post("/api/algohunt/codes/redeem", { code: fixture.codes[0].code, teamId })),
      await run(post("/api/algohunt/run", { language: "cpp", code: "x", stdin: "", teamId })),
      await integrity(post("/api/algohunt/integrity", { action: "leave", reasons: ["hidden"], teamId })),
    ]) {
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("VALIDATION");
    }
  });

  it("2. no participant route takes a question number, so a locked or past question can't be opened", async () => {
    as(0);
    for (const body of [{ stageNumber: 2 }, { stageId: fixture.stages[1].id }, { challengeId: fixture.challenges[1].id }]) {
      const res = await submit(post("/api/algohunt/submissions", { language: "cpp", code: "x", clientRequestId: crypto.randomUUID(), ...body }));
      expect(res.status).toBe(400);
    }
    expect((await (await currentChallenge(get("/api/algohunt/challenges/current"))).json()).challenge.stageNumber).toBe(1);
  });

  it("3. a code is always redeemed for the team in the cookie", async () => {
    as(0);
    await submitCode("ACCEPT");
    const res = await (await redeem(post("/api/algohunt/codes/redeem", { code: fixture.codes[0].code }))).json();
    expect(res.result).toBe("UNLOCKED");
    const [teamB] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, fixture.teams[1].team.id));
    expect(teamB.status).toBe("CHECKED_IN");
    as(1);
    const stateB = await (await stateRoute.GET(get("/api/algohunt/state"))).json();
    expect(stateB.current.number).toBe(1);
  });

  it("4. a participant calling any admin route is refused", async () => {
    as(0);
    const modules = import.meta.glob("../../app/api/admin/algohunt/**/route.ts");
    const params = Promise.resolve({
      teamId: fixture.teams[0].team.id, eventId: fixture.event.id, id: "x", codeId: "x", batchId: "x",
      challengeId: fixture.challenges[0].id, stageId: fixture.stages[0].id,
    });
    let checked = 0;
    for (const [path, load] of Object.entries(modules)) {
      const mod = await load() as Record<string, unknown>;
      for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
        const handler = mod[method] as ((req: Request, ctx: { params: typeof params }) => Promise<Response>) | undefined;
        if (!handler) continue;
        const req = new Request(`${ORIGIN}/api/admin/algohunt/x?event=${fixture.event.slug}`, {
          method,
          headers: { "content-type": "application/json", origin: ORIGIN },
          body: method === "GET" ? undefined : JSON.stringify({ confirm: fixture.event.slug }),
        });
        const res = await handler(req, { params });
        expect([401, 403], `${method} ${path} returned ${res.status}`).toContain(res.status);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("5. no participant response carries test data, solutions, pool codes, password hashes or future titles", async () => {
    as(0);
    await submitCode("WRONG");
    const bodies = [
      await (await stateRoute.GET(get("/api/algohunt/state"))).text(),
      await (await currentChallenge(get("/api/algohunt/challenges/current"))).text(),
      await (await leaderboardRoute.GET()).text(),
      await (await listSubmissions(get("/api/algohunt/submissions"))).text(),
      await (await me()).text(),
    ].join("\n");
    const tests = await getDb().select().from(ahTestCases);
    for (const t of tests.filter((row) => !row.isSample)) expect(bodies).not.toContain(t.output);
    expect(bodies).not.toContain("std::cin>>n"); // the fixture's reference solution
    for (const code of fixture.codes) expect(bodies).not.toContain(code.code);
    expect(bodies).not.toContain("pbkdf2$");
    expect(bodies).not.toContain(`"${fixture.challenges[1].title}"`);
    expect(bodies).not.toContain(`"${fixture.challenges[2].title}"`);
  });

  it("6. scores can't be changed: state and leaderboard are GET-only and server-computed", () => {
    for (const mod of [stateRoute, leaderboardRoute] as Record<string, unknown>[]) {
      expect(Object.keys(mod).filter((key) => ["POST", "PUT", "PATCH", "DELETE"].includes(key))).toEqual([]);
    }
  });

  it("7. a cookie forged with another team's id is rejected", async () => {
    as(0);
    const jar = await cookies();
    const real = jar.get("ah_team")!.value;
    const forged = real.replace(fixture.teams[0].team.id, fixture.teams[1].team.id);
    jar.set("ah_team", forged);
    expect((await stateRoute.GET(get("/api/algohunt/state"))).status).toBe(401);
  });

  it("8. a team can't finish without solving the final question", async () => {
    as(0);
    await submitCode("ACCEPT"); await (await redeem(post("/api/algohunt/codes/redeem", { code: fixture.codes[0].code }))).json();
    await submitCode("ACCEPT"); await (await redeem(post("/api/algohunt/codes/redeem", { code: fixture.codes[1].code }))).json();
    await submitCode("WRONG");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    try {
      const res = await (await redeem(post("/api/algohunt/codes/redeem", { code: fixture.codes[2].code }))).json();
      expect(res.code).toBe("CHALLENGE_NOT_SOLVED");
    } finally {
      vi.useRealTimers();
    }
    const [team] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, fixture.teams[0].team.id));
    expect(team.status).toBe("CHECKED_IN");
    expect(team.finishedAt).toBeNull();
  });

  it("9. codes can't be brute-forced: 5 wrong codes in 10 minutes trigger a cooldown", async () => {
    as(0);
    await submitCode("ACCEPT");
    for (const code of ["QQQQQQQQ", "RRRRRRRR", "SSSSSSSS", "TTTTTTTT", "VVVVVVVV"]) {
      expect((await (await redeem(post("/api/algohunt/codes/redeem", { code }))).json()).result).toBe("INVALID");
    }
    const res = await redeem(post("/api/algohunt/codes/redeem", { code: fixture.codes[0].code }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("COOLDOWN");
  });

  it("10. duplicate requests never duplicate progression or use a code twice", async () => {
    as(0);
    await submitCode("ACCEPT");
    const code = fixture.codes[0].code;
    const results = await Promise.all([1, 2, 3].map(async () => (await redeem(post("/api/algohunt/codes/redeem", { code }))).json()));
    expect(results.filter((r) => r.result === "UNLOCKED")).toHaveLength(1);
    const state = await (await stateRoute.GET(get("/api/algohunt/state"))).json();
    expect(state.current.number).toBe(2);
    expect(state.solvedCount).toBe(1);
  });
});
