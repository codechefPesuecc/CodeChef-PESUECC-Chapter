process.env.DATABASE_URL = ":memory:";

import crypto from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST as login } from "@/app/api/algohunt/auth/login/route";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahCodeAttempts, ahSubmissions, ahTeamMembers, ahTeams } from "@/server/db/schema";
import { disqualifyTeam, redeemCode } from "../progression";
import { getCurrentTeam } from "../teamSession";
import { resetAlgoHuntTables, setupTestDb } from "../testing/db";
import { createSiteUser, ctxFor, seedFixture, solveCurrent, type Fixture } from "../testing/fixtures";
import { clearCookies, setTeamCookie } from "../testing/next-headers-mock";
import { getTeamDetail, getTeamTimeline, listTeams, resetTeamPassword } from "./teams";

vi.mock("next/headers", () => import("../testing/next-headers-mock"));

const SOURCE_MARKER = "int main() { /* teams-secret-source */ }";

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function loginRequest(teamCode: string, password: string) {
  return login(new Request("https://chapter.example/api/algohunt/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.9" },
    body: JSON.stringify({ teamCode, password }),
  }));
}

/** Alpha used code #001 on Q1 and waits on Q2; Beta is disqualified; Team 3 has not started. */
async function seedTeams(): Promise<Fixture> {
  const fixture = await seedFixture({ teams: 3, stages: 3 });
  const [alpha, beta] = fixture.teams.map((t) => t.team);
  const [q1, q2] = fixture.stages;
  const now = Date.now();

  await solveCurrent(fixture, 0);
  await getDb().insert(ahCodeAttempts).values({
    id: crypto.randomUUID(), eventId: fixture.event.id, teamId: alpha.id, stageId: q1.id,
    submittedCode: fixture.codes[4].code, result: "INVALID", createdAt: now - 5_000,
  });
  await redeemCode({ ctx: ctxFor(fixture, 0), stageId: q1.id, code: fixture.codes[0].code });
  await getDb().insert(ahSubmissions).values({
    id: crypto.randomUUID(), eventId: fixture.event.id, teamId: alpha.id, stageId: q2.id,
    challengeId: fixture.challenges[1].id, language: "cpp", code: SOURCE_MARKER,
    status: "DONE", verdict: "WA", failedOn: 2, createdAt: now - 1_000, finishedAt: now - 900,
  });
  await solveCurrent(fixture, 0);
  await getDb().insert(ahTeamMembers).values([
    { id: crypto.randomUUID(), teamId: alpha.id, name: "Riya", email: "riya@example.test", phone: "9000000001", isCaptain: false, createdAt: now },
    { id: crypto.randomUUID(), teamId: alpha.id, name: "Kabir", email: null, phone: null, isCaptain: true, createdAt: now },
  ]);
  const admin = await createSiteUser({ isAdmin: true });
  await disqualifyTeam({ eventId: fixture.event.id, teamId: beta.id, adminId: admin.id, reason: "shared answers" });
  await getDb().update(ahTeams).set({ status: "REGISTERED", checkedInAt: null })
    .where(eq(ahTeams.id, fixture.teams[2].team.id));
  return fixture;
}

describe("listTeams", () => {
  it("summarises progress, waiting and last activity per team", async () => {
    const fixture = await seedTeams();
    const rows = await listTeams(fixture.event.id, {});
    expect(rows.map((r) => r.code)).toEqual(["AH2-T001", "AH2-T002", "AH2-T003"]);
    const [alpha, beta, third] = rows;
    expect(alpha).toMatchObject({
      name: "Team Alpha", status: "CHECKED_IN", currentQuestion: 2, questionsSolved: 2,
      waitingForCode: true, totalStages: 3,
    });
    expect(alpha.waitingSince).not.toBeNull();
    expect(alpha.lastActivityAt).not.toBeNull();
    expect(beta).toMatchObject({ status: "DISQUALIFIED", currentQuestion: null, waitingForCode: false, lastActivityAt: null });
    expect(third).toMatchObject({ status: "REGISTERED", currentQuestion: null, questionsSolved: 0, checkedInAt: null });
  });

  it("filters by status and searches code, name and college as plain text", async () => {
    const fixture = await seedTeams();
    expect((await listTeams(fixture.event.id, { status: "DISQUALIFIED" })).map((r) => r.code)).toEqual(["AH2-T002"]);
    expect((await listTeams(fixture.event.id, { q: "beta" })).map((r) => r.code)).toEqual(["AH2-T002"]);
    expect((await listTeams(fixture.event.id, { q: "t003" })).map((r) => r.code)).toEqual(["AH2-T003"]);
    expect(await listTeams(fixture.event.id, { q: "%" })).toEqual([]);
  });
});

describe("getTeamDetail", () => {
  it("returns members, progress, codes by serial and submissions without source", async () => {
    const fixture = await seedTeams();
    const detail = await getTeamDetail(fixture.teams[0].team.id);
    expect(detail).not.toBeNull();
    expect(detail!.team).not.toHaveProperty("passwordHash");
    expect(detail!.members.map((m) => m.name)).toEqual(["Kabir", "Riya"]);
    expect(detail!.progress.current?.stage.stageNumber).toBe(2);
    expect(detail!.codesUsed).toEqual([{ serial: 1, stageNumber: 1, usedAt: expect.any(Number) }]);
    expect(detail!.submissions).toEqual([expect.objectContaining({ stageNumber: 2, verdict: "WA", failedOn: 2 })]);
    expect(detail!.codeAttempts.map((a) => a.result)).toEqual(expect.arrayContaining(["INVALID"]));
    const json = JSON.stringify({ ...detail, codeAttempts: [] });
    expect(json).not.toContain(SOURCE_MARKER);
    expect(json).not.toContain(fixture.codes[0].code);
  });

  it("returns null for an unknown team", async () => {
    expect(await getTeamDetail("missing")).toBeNull();
  });
});

describe("getTeamTimeline", () => {
  it("merges audit rows, submissions and code attempts oldest first without source or code values", async () => {
    const fixture = await seedTeams();
    const timeline = await getTeamTimeline(fixture.teams[0].team.id);
    const kinds = new Set(timeline.map((e) => e.kind));
    expect(kinds.has("submission")).toBe(true);
    expect(kinds.has("code")).toBe(true);
    expect(kinds.has("progress")).toBe(true);
    const times = timeline.map((e) => e.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const texts = timeline.map((e) => e.text);
    expect(texts).toContain("Team Alpha solved Question 1");
    expect(texts).toContain("Team Alpha unlocked Question 2 with code #001");
    expect(texts).toContain("Team Alpha got WA on Question 2 (test 2)");
    expect(texts).toContain("Team Alpha entered a code on Question 1: INVALID");
    expect(texts).not.toContain("Team Alpha completed Question 1 with code #001");

    const json = JSON.stringify(timeline);
    expect(json).not.toContain(SOURCE_MARKER);
    for (const code of fixture.codes) expect(json).not.toContain(code.code);
  });
});

describe("resetTeamPassword", () => {
  it("logs out old sessions, lets the new password in and keeps it out of the audit row", async () => {
    const fixture = await seedFixture();
    const team = fixture.teams[0].team;
    const admin = await createSiteUser({ isAdmin: true });
    setTeamCookie(team.id, 0);
    expect(await getCurrentTeam()).not.toBeNull();

    const { password } = await resetTeamPassword({ teamId: team.id, adminId: admin.id });
    expect(password).toMatch(/^\S{10}$/);
    expect(await getCurrentTeam()).toBeNull();

    clearCookies();
    expect((await loginRequest(team.teamCode, fixture.teams[0].password)).status).toBe(401);
    expect((await loginRequest(team.teamCode, password)).status).toBe(200);

    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "team.password_reset"));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ teamId: team.id, actorType: "ADMIN", actorId: admin.id });
    expect(JSON.stringify(audits[0])).not.toContain(password);
  });

  it("throws for an unknown team", async () => {
    await expect(resetTeamPassword({ teamId: "missing", adminId: "admin" })).rejects.toThrow("Team not found");
  });
});
