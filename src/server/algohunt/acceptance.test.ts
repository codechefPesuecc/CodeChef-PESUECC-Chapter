process.env.DATABASE_URL = ":memory:";

/**
 * Acceptance suite (M6 brief §8): the event's rules, driven through the real route handlers with
 * an in-memory database. Only the judge is mocked: code containing "ACCEPT" is AC, anything else WA.
 */
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahCodes, ahSubmissions, ahTeams } from "@/server/db/schema";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { createSiteUser, ctxFor, seedFixture, type Fixture } from "./testing/fixtures";
import { clearCookies, setSiteSessionCookie, setTeamCookie } from "./testing/next-headers-mock";

vi.mock("next/headers", () => import("./testing/next-headers-mock"));
vi.mock("@/server/judge", () => ({
  judgeTests: vi.fn(async (p: { code: string; tests: unknown[] }) => (p.code.includes("ACCEPT")
    ? { verdict: "AC", passed: p.tests.length, total: p.tests.length }
    : { verdict: "WA", passed: 0, total: p.tests.length, failedOn: 1 })),
}));

const { POST: login } = await import("@/app/api/algohunt/auth/login/route");
const { POST: submit, GET: listSubmissions } = await import("@/app/api/algohunt/submissions/route");
const { POST: redeem } = await import("@/app/api/algohunt/codes/redeem/route");
const { GET: currentChallenge } = await import("@/app/api/algohunt/challenges/current/route");
const { GET: getState } = await import("@/app/api/algohunt/state/route");
const { GET: getLeaderboard } = await import("@/app/api/algohunt/leaderboard/route");
const { POST: override } = await import("@/app/api/admin/algohunt/teams/[teamId]/override/route");

const ORIGIN = "https://chapter.example";

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7", ...headers },
    body: JSON.stringify(body),
  });
}
const get = (path: string) => new Request(`${ORIGIN}${path}`);

let fixture: Fixture;
function as(teamIndex: number) {
  const { team } = fixture.teams[teamIndex];
  setTeamCookie(team.id, team.sessionEpoch);
}
async function submitCode(code: string, clientRequestId: string = crypto.randomUUID()) {
  return (await submit(post("/api/algohunt/submissions", { language: "cpp", code, clientRequestId }))).json();
}
async function enter(code: string) {
  return (await redeem(post("/api/algohunt/codes/redeem", { code }))).json();
}
async function current() {
  return (await currentChallenge(get("/api/algohunt/challenges/current"))).json();
}
async function codeStatus(code: string) {
  const [row] = await getDb().select({ status: ahCodes.status }).from(ahCodes).where(eq(ahCodes.code, code));
  return row.status;
}

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
  fixture = await seedFixture({ stages: 3, teams: 2, codes: 6 });
});

describe("AlgoHunt acceptance (M6 brief §8)", () => {
  it("1. solving Q1 without a code keeps the team on Q1 (CODE_PENDING); Q2 stays hidden", async () => {
    as(0);
    expect((await submitCode("ACCEPT")).stage).toMatchObject({ number: 1, challengeSolved: true, needsCode: true });
    const cur = await current();
    expect(cur.challenge.stageNumber).toBe(1);
    const state = await (await getState(get("/api/algohunt/state"))).json();
    expect(state.current).toMatchObject({ number: 1, state: "CODE_PENDING" });
    expect(state.stages[1]).toMatchObject({ number: 2, state: "LOCKED", title: null });
  });

  it("2. a wrong code after solving leaves the team on Q1 with INVALID", async () => {
    as(0);
    await submitCode("ACCEPT");
    expect(await enter("ZZZZZZZZ")).toMatchObject({ ok: true, result: "INVALID" });
    expect((await current()).challenge.stageNumber).toBe(1);
  });

  it("3. a valid code after solving unlocks Q2 and the code is USED", async () => {
    as(0);
    await submitCode("ACCEPT");
    expect(await enter(fixture.codes[0].code)).toMatchObject({ ok: true, result: "UNLOCKED", unlockedStageNumber: 2 });
    expect((await current()).challenge.stageNumber).toBe(2);
    expect(await codeStatus(fixture.codes[0].code)).toBe("USED");
  });

  it("4. there is no going back: on Q2, nothing returns Q1 and the submissions list has no Q1 rows", async () => {
    as(0);
    await submitCode("ACCEPT");
    await enter(fixture.codes[0].code);
    expect((await current()).challenge.stageNumber).toBe(2);
    const list = await (await listSubmissions(get("/api/algohunt/submissions"))).json();
    expect(list.submissions).toEqual([]);
    // No participant route takes a question number: extra fields are rejected.
    const res = await submit(post("/api/algohunt/submissions", { language: "cpp", code: "ACCEPT", clientRequestId: crypto.randomUUID(), stageNumber: 1 }));
    expect(res.status).toBe(400);
  });

  it("5. a code entered before solving is refused and stays ACTIVE", async () => {
    as(0);
    expect(await enter(fixture.codes[0].code)).toMatchObject({ ok: false, code: "CHALLENGE_NOT_SOLVED" });
    expect(await codeStatus(fixture.codes[0].code)).toBe("ACTIVE");
  });

  it("6. two teams entering the same code at once: one UNLOCKED, one ALREADY_USED", async () => {
    as(0); await submitCode("ACCEPT");
    as(1); await submitCode("ACCEPT");
    // The test cookie jar is one global, so two teams racing go through the engine the route calls.
    const { redeemCodeForTeam } = await import("./codePool");
    const code = fixture.codes[0].code;
    const [a, b] = await Promise.all([0, 1].map((i) =>
      redeemCodeForTeam({ ctx: ctxFor(fixture, i), rawCode: code, ip: "198.51.100.7" })));
    const results = [a, b].map((r) => (r.ok ? r.result.result : r.code)).sort();
    expect(results).toEqual(["ALREADY_USED", "UNLOCKED"]);
  });

  it("7. one team entering two codes at once: one UNLOCKED, one ALREADY_UNLOCKED; the second code stays ACTIVE", async () => {
    as(0);
    await submitCode("ACCEPT");
    const [a, b] = await Promise.all([enter(fixture.codes[0].code), enter(fixture.codes[1].code)]);
    expect([a.result, b.result].sort()).toEqual(["ALREADY_UNLOCKED", "UNLOCKED"]);
    const statuses = [await codeStatus(fixture.codes[0].code), await codeStatus(fixture.codes[1].code)].sort();
    expect(statuses).toEqual(["ACTIVE", "USED"]);
  });

  it("8. re-entering a used code after solving Q2 is ALREADY_USED and Q2 stays CODE_PENDING", async () => {
    as(0);
    await submitCode("ACCEPT");
    await enter(fixture.codes[0].code);
    await submitCode("ACCEPT");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000); // past the "just unlocked" retry window
    try {
      expect(await enter(fixture.codes[0].code)).toMatchObject({ result: "ALREADY_USED" });
    } finally {
      vi.useRealTimers();
    }
    const state = await (await getState(get("/api/algohunt/state"))).json();
    expect(state.current).toMatchObject({ number: 2, state: "CODE_PENDING" });
  });

  it("9. solving the final question finishes the team with no code, and it leads the leaderboard", async () => {
    as(0);
    await submitCode("ACCEPT"); await enter(fixture.codes[0].code);
    await submitCode("ACCEPT"); await enter(fixture.codes[1].code);
    const final = await submitCode("ACCEPT");
    expect(final.stage).toMatchObject({ number: 3, finished: true, needsCode: false });
    const [team] = await getDb().select({ status: ahTeams.status }).from(ahTeams).where(eq(ahTeams.id, fixture.teams[0].team.id));
    expect(team.status).toBe("FINISHED");
    const board = await (await getLeaderboard()).json();
    expect(board.rows[0]).toMatchObject({ teamName: "Team Alpha", finished: true, questionsSolved: 3 });
  });

  it("10. an admin 'unlock without code' moves the team on, uses no code, and is audited with the reason", async () => {
    as(0);
    await submitCode("ACCEPT");
    const admin = await createSiteUser({ isAdmin: true });
    setSiteSessionCookie(admin.id);
    const res = await override(post(`/api/admin/algohunt/teams/${fixture.teams[0].team.id}/override`, {
      action: "COMPLETE_STAGE", stageNumber: 1, reason: "QR was damaged", confirm: fixture.teams[0].team.teamCode,
    }, { origin: ORIGIN }), { params: Promise.resolve({ teamId: fixture.teams[0].team.id }) });
    expect(res.status).toBe(200);
    as(0);
    expect((await current()).challenge.stageNumber).toBe(2);
    const used = await getDb().select().from(ahCodes).where(eq(ahCodes.status, "USED"));
    expect(used).toHaveLength(0);
    const [audit] = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "override.complete_stage"));
    expect(audit.actorId).toBe(admin.id);
    expect(JSON.parse(audit.metadata)).toMatchObject({ stageNumber: 1, reason: "QR was damaged" });
  });

  it("11. the same clientRequestId submitted twice makes one submission row", async () => {
    as(0);
    const id = crypto.randomUUID();
    const [a, b] = [await submitCode("WRONG", id), await submitCode("WRONG", id)];
    expect(a.submission.id).toBe(b.submission.id);
    const rows = await getDb().select().from(ahSubmissions).where(and(eq(ahSubmissions.teamId, fixture.teams[0].team.id), eq(ahSubmissions.clientRequestId, id)));
    expect(rows).toHaveLength(1);
  });

  it("12. one laptop per team: a second login signs the first one out and is audited as a takeover", async () => {
    const team = fixture.teams[0];
    const first = await login(post("/api/algohunt/auth/login", { teamCode: team.team.teamCode, password: team.password }));
    expect(first.status).toBe(200);
    const firstCookie = /ah_team=([^;]+)/.exec(first.headers.get("set-cookie") ?? "")![1];
    clearCookies(); // a different browser: no ah_device cookie, so a different device id
    const second = await login(post("/api/algohunt/auth/login", { teamCode: team.team.teamCode, password: team.password }));
    expect(second.status).toBe(200);

    const { cookies } = await import("./testing/next-headers-mock");
    (await cookies()).set("ah_team", decodeURIComponent(firstCookie));
    expect((await getState(get("/api/algohunt/state"))).status).toBe(401);
    const takeovers = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "team.session_takeover"));
    expect(takeovers).toHaveLength(1);
  });
});
