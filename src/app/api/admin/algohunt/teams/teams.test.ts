process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { getCodePoolStats } from "@/server/algohunt/codePool";
import { assertTeamCanPlay, getTeamProgress } from "@/server/algohunt/access";
import { computeLeaderboard } from "@/server/algohunt/leaderboard";
import { redeemCode } from "@/server/algohunt/progression";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, ctxFor, seedFixture, solveCurrent, type Fixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "@/server/algohunt/testing/next-headers-mock";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahCodes, ahStageProgress, ahTeams } from "@/server/db/schema";
import { GET as getTeams } from "./route";
import { POST as checkinAll } from "./checkin-all/route";
import { GET as getDetail } from "./[teamId]/route";
import { POST as checkin } from "./[teamId]/checkin/route";
import { POST as disqualify } from "./[teamId]/disqualify/route";
import { POST as override } from "./[teamId]/override/route";
import { POST as reinstate } from "./[teamId]/reinstate/route";
import { POST as resetPassword } from "./[teamId]/reset-password/route";
import { GET as getTimeline } from "./[teamId]/timeline/route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

async function signInAdmin(): Promise<{ id: string; username: string }> {
  const admin = await createSiteUser({ isAdmin: true });
  setSiteSessionCookie(admin.id);
  return admin;
}

function jsonRequest(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://chapter.example${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const auditRows = (action: string) => getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, action));
const teamParams = (teamId: string) => ({ params: Promise.resolve({ teamId }) });

async function teamRow(teamId: string) {
  const [row] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, teamId));
  return row;
}

async function progressRow(teamId: string, stageId: string) {
  const [row] = await getDb().select().from(ahStageProgress)
    .where(and(eq(ahStageProgress.teamId, teamId), eq(ahStageProgress.stageId, stageId)));
  return row;
}

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function postOverride(f: Fixture, body: unknown, headers?: Record<string, string>) {
  const teamId = f.teams[0].team.id;
  return override(jsonRequest("POST", `/api/admin/algohunt/teams/${teamId}/override`, body, headers), teamParams(teamId));
}

describe("POST teams/[teamId]/override COMPLETE_STAGE", () => {
  it("rejects a missing reason, a short reason and a wrong confirm, and changes nothing", async () => {
    const f = await seedFixture({ stages: 3, codes: 3 });
    await signInAdmin();
    await solveCurrent(f);
    const code = f.teams[0].team.teamCode;
    const base = { action: "COMPLETE_STAGE", stageNumber: 1, confirm: code };

    const noReason = await postOverride(f, base);
    expect(noReason.status).toBe(400);
    expect(await noReason.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((await postOverride(f, { ...base, reason: "abc" })).status).toBe(400);

    for (const confirm of ["", "wrong", code.toLowerCase(), `${code} `]) {
      const response = await postOverride(f, { ...base, reason: "QR pool empty", confirm });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION", error: "Confirmation text does not match." });
    }
    expect((await progressRow(f.teams[0].team.id, f.stages[0].id)).completed).toBe(false);
    expect(await auditRows("override.complete_stage")).toHaveLength(0);
  });

  it("unlocks the next question without consuming a code and records who and why", async () => {
    const f = await seedFixture({ stages: 3, codes: 3 });
    const admin = await signInAdmin();
    await solveCurrent(f);
    const poolCounts = async () => {
      const { total, active, used, disabled } = await getCodePoolStats(f.event.id);
      return { total, active, used, disabled };
    };
    const poolBefore = await poolCounts();

    const response = await postOverride(f, {
      action: "COMPLETE_STAGE", stageNumber: 1, reason: "QR pool empty", confirm: f.teams[0].team.teamCode,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, changed: true });

    const row = await progressRow(f.teams[0].team.id, f.stages[0].id);
    expect(row).toMatchObject({ completed: true, manualOverride: true, overrideReason: "QR pool empty", overrideBy: admin.id });
    expect(await poolCounts()).toEqual(poolBefore);

    const audits = await auditRows("override.complete_stage");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorType: "ADMIN", actorId: admin.id, teamId: f.teams[0].team.id });
    expect(JSON.parse(audits[0].metadata)).toMatchObject({ stageNumber: 1, reason: "QR pool empty" });

    const progress = await getTeamProgress(ctxFor(f));
    expect(progress.current?.stage.stageNumber).toBe(2);
    expect(progress.current?.accessible).toBe(true);
  });

  it("answers CONFLICT for a locked question and changes nothing", async () => {
    const f = await seedFixture({ stages: 3, codes: 3 });
    await signInAdmin();
    const response = await postOverride(f, {
      action: "COMPLETE_STAGE", stageNumber: 3, reason: "Skip ahead", confirm: f.teams[0].team.teamCode,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await progressRow(f.teams[0].team.id, f.stages[2].id)).toBeUndefined();
    expect(await auditRows("override.complete_stage")).toHaveLength(0);
  });

  it("answers NOT_FOUND for a question number the event does not have", async () => {
    const f = await seedFixture({ stages: 2 });
    await signInAdmin();
    const response = await postOverride(f, {
      action: "COMPLETE_STAGE", stageNumber: 99, reason: "No such question", confirm: f.teams[0].team.teamCode,
    });
    expect(response.status).toBe(404);
  });

  it("rejects unknown fields and cross-site requests", async () => {
    const f = await seedFixture({ stages: 2 });
    await signInAdmin();
    const body = { action: "COMPLETE_STAGE", stageNumber: 1, reason: "Strict body", confirm: f.teams[0].team.teamCode };
    expect((await postOverride(f, { ...body, extra: true })).status).toBe(400);
    const crossSite = await postOverride(f, body, { origin: "https://evil.example" });
    expect(crossSite.status).toBe(403);
    expect(await auditRows("override.complete_stage")).toHaveLength(0);
  });
});

describe("POST teams/[teamId]/override REVERT_STAGE", () => {
  async function finishedTeam() {
    const f = await seedFixture({ stages: 2, codes: 2 });
    const admin = await signInAdmin();
    await solveCurrent(f);
    expect((await redeemCode({ ctx: ctxFor(f), stageId: f.stages[0].id, code: f.codes[0].code })).outcome).toBe("UNLOCKED");
    await solveCurrent(f);
    expect((await teamRow(f.teams[0].team.id)).status).toBe("FINISHED");
    return { f, admin };
  }

  it("reopens the final question of a finished team and keeps the code USED", async () => {
    const { f, admin } = await finishedTeam();
    expect((await teamRow(f.teams[0].team.id)).status).toBe("FINISHED");

    const response = await postOverride(f, {
      action: "REVERT_STAGE", stageNumber: 2, reason: "Wrong team finished", confirm: f.teams[0].team.teamCode,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, changed: true });

    expect(await progressRow(f.teams[0].team.id, f.stages[1].id)).toMatchObject({ completed: false, challengeSolved: false });
    expect(await teamRow(f.teams[0].team.id)).toMatchObject({ status: "CHECKED_IN", finishedAt: null });
    const audits = await auditRows("override.revert_stage");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: admin.id });
    const [code] = await getDb().select().from(ahCodes).where(eq(ahCodes.id, f.codes[0].id));
    expect(code.status).toBe("USED");
  });

  it("answers CONFLICT for a completed question that is not the latest", async () => {
    const { f } = await finishedTeam();
    const response = await postOverride(f, {
      action: "REVERT_STAGE", stageNumber: 1, reason: "Revert an early one", confirm: f.teams[0].team.teamCode,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await auditRows("override.revert_stage")).toHaveLength(0);
    expect((await progressRow(f.teams[0].team.id, f.stages[0].id)).completed).toBe(true);
  });
});

describe("disqualify and reinstate", () => {
  function call(handler: typeof disqualify, f: Fixture, body: unknown) {
    const teamId = f.teams[0].team.id;
    return handler(jsonRequest("POST", `/api/admin/algohunt/teams/${teamId}/x`, body), teamParams(teamId));
  }

  it("removes the team from the public leaderboard, blocks play, then restores the previous status", async () => {
    const f = await seedFixture({ stages: 2, teams: 2 });
    const admin = await signInAdmin();
    const teamId = f.teams[0].team.id;
    const code = f.teams[0].team.teamCode;
    await solveCurrent(f);
    expect((await computeLeaderboard(f.event.id, { includeDisqualified: false })).rows.map((r) => r.teamCode)).toContain(code);

    expect((await call(disqualify, f, { reason: "ab", confirm: code })).status).toBe(400);
    expect((await call(disqualify, f, { reason: "Shared answers", confirm: "wrong" })).status).toBe(400);
    expect((await teamRow(teamId)).status).toBe("CHECKED_IN");

    const dq = await call(disqualify, f, { reason: "Shared answers", confirm: code });
    expect(dq.status).toBe(200);
    expect(await dq.json()).toMatchObject({ ok: true, changed: true });
    const disqualified = await teamRow(teamId);
    expect(disqualified.status).toBe("DISQUALIFIED");
    expect((await computeLeaderboard(f.event.id, { includeDisqualified: false })).rows.map((r) => r.teamCode)).not.toContain(code);
    expect(assertTeamCanPlay({ team: disqualified, event: f.event }, "submit")?.code).toBe("TEAM_DISQUALIFIED");
    expect((await auditRows("team.disqualified"))[0]).toMatchObject({ actorId: admin.id, teamId });

    const again = await call(disqualify, f, { reason: "Shared answers", confirm: code });
    expect(await again.json()).toMatchObject({ ok: true, changed: false });
    expect(await auditRows("team.disqualified")).toHaveLength(1);

    const back = await call(reinstate, f, { reason: "Appeal accepted", confirm: code });
    expect(back.status).toBe(200);
    expect(await back.json()).toMatchObject({ ok: true, changed: true });
    expect((await teamRow(teamId)).status).toBe("CHECKED_IN");
    expect(await auditRows("team.reinstated")).toHaveLength(1);
  });
});

describe("POST teams/checkin-all", () => {
  function callAll(f: Fixture, body: unknown) {
    return checkinAll(jsonRequest("POST", `/api/admin/algohunt/teams/checkin-all?event=${f.event.slug}`, body));
  }

  it("rejects a wrong confirm, then checks in only the REGISTERED teams", async () => {
    const f = await seedFixture({ teams: 4 });
    await signInAdmin();
    const db = getDb();
    const [, b, c, d] = f.teams.map((t) => t.team.id);
    await db.update(ahTeams).set({ status: "REGISTERED", checkedInAt: null }).where(eq(ahTeams.id, b));
    await db.update(ahTeams).set({ status: "REGISTERED", checkedInAt: null }).where(eq(ahTeams.id, c));
    await db.update(ahTeams).set({ status: "DISQUALIFIED" }).where(eq(ahTeams.id, d));

    const wrong = await callAll(f, { confirm: "wrong" });
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((await teamRow(b)).status).toBe("REGISTERED");

    const response = await callAll(f, { confirm: f.event.slug });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, count: 2 });
    expect((await teamRow(b)).status).toBe("CHECKED_IN");
    expect((await teamRow(c)).status).toBe("CHECKED_IN");
    expect((await teamRow(d)).status).toBe("DISQUALIFIED");
    expect(await auditRows("team.checked_in")).toHaveLength(2);
  });

  it("changes nothing once the event has ended", async () => {
    const f = await seedFixture({ eventStatus: "ENDED" });
    await signInAdmin();
    await getDb().update(ahTeams).set({ status: "REGISTERED", checkedInAt: null }).where(eq(ahTeams.id, f.teams[0].team.id));
    const response = await callAll(f, { confirm: f.event.slug });
    expect(response.status).toBe(403);
    expect((await teamRow(f.teams[0].team.id)).status).toBe("REGISTERED");
  });
});

describe("POST teams/[teamId]/checkin", () => {
  it("checks in one registered team and is idempotent", async () => {
    const f = await seedFixture();
    await signInAdmin();
    const teamId = f.teams[0].team.id;
    await getDb().update(ahTeams).set({ status: "REGISTERED", checkedInAt: null }).where(eq(ahTeams.id, teamId));
    const call = () => checkin(jsonRequest("POST", `/api/admin/algohunt/teams/${teamId}/checkin`), teamParams(teamId));

    expect(await (await call()).json()).toMatchObject({ ok: true, alreadyCheckedIn: false, team: { status: "CHECKED_IN" } });
    expect(await (await call()).json()).toMatchObject({ ok: true, alreadyCheckedIn: true });
    expect(await auditRows("team.checked_in")).toHaveLength(1);
  });

  it("answers NOT_FOUND for an unknown team", async () => {
    await signInAdmin();
    const response = await checkin(jsonRequest("POST", "/x"), teamParams("missing"));
    expect(response.status).toBe(404);
  });
});

describe("POST teams/[teamId]/reset-password", () => {
  it("needs the team code, returns the new password once with no-store, and never audits it", async () => {
    const f = await seedFixture();
    await signInAdmin();
    const teamId = f.teams[0].team.id;
    const call = (confirm: string) =>
      resetPassword(jsonRequest("POST", `/api/admin/algohunt/teams/${teamId}/reset-password`, { confirm }), teamParams(teamId));

    expect((await call("wrong")).status).toBe(400);
    expect(await auditRows("team.password_reset")).toHaveLength(0);

    const response = await call(f.teams[0].team.teamCode);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, password: expect.stringMatching(/^\S{10}$/) });
    const audits = await auditRows("team.password_reset");
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0])).not.toContain(body.password);
  });
});

describe("read routes", () => {
  it("returns the team list with a server clock, and rejects a bad status filter", async () => {
    const f = await seedFixture({ teams: 2 });
    await signInAdmin();
    const ok = await getTeams(new Request(`https://chapter.example/api/admin/algohunt/teams?event=${f.event.slug}&q=alpha`));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.teams).toHaveLength(1);
    expect(typeof body.serverNow).toBe("number");

    const bad = await getTeams(new Request(`https://chapter.example/api/admin/algohunt/teams?event=${f.event.slug}&status=BOGUS`));
    expect(bad.status).toBe(400);
    const missing = await getTeams(new Request("https://chapter.example/api/admin/algohunt/teams?event=no-such-event"));
    expect(missing.status).toBe(404);
  });

  it("returns team detail without the password hash, and the timeline, or 404", async () => {
    const f = await seedFixture();
    await signInAdmin();
    const teamId = f.teams[0].team.id;
    const detail = await getDetail(new Request("https://chapter.example/x"), teamParams(teamId));
    expect(detail.status).toBe(200);
    const body = await detail.json();
    expect(body.team.teamCode).toBe(f.teams[0].team.teamCode);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain(f.teams[0].team.passwordHash);

    const timeline = await getTimeline(new Request("https://chapter.example/x"), teamParams(teamId));
    expect(await timeline.json()).toMatchObject({ ok: true, timeline: expect.any(Array) });
    expect((await getDetail(new Request("https://chapter.example/x"), teamParams("missing"))).status).toBe(404);
    expect((await getTimeline(new Request("https://chapter.example/x"), teamParams("missing"))).status).toBe(404);
  });
});
