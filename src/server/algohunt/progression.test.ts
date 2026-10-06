process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ahAuditLogs, ahCodes, ahStageProgress, ahTeams } from "@/server/db/schema";
import { getTeamProgress } from "./access";
import { ctxFor, seedFixture } from "./testing/fixtures";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import {
  adminCompleteStage, adminRevertStage, disqualifyTeam, recordChallengeSolved,
  redeemCode, reinstateTeam,
} from "./progression";

beforeAll(setupTestDb);
beforeEach(resetAlgoHuntTables);

describe("progression engine", () => {
  it("holds the next question until an unused code atomically completes the current one", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    const q1 = fixture.stages[0];
    const solved = await recordChallengeSolved({ ctx, stageId: q1.id, submissionId: "submission-1" });
    expect(solved).toEqual({ alreadySolved: false, finished: false });
    let progress = await getTeamProgress(ctx);
    expect(progress.current?.state).toBe("CODE_PENDING");
    expect(progress.stages[1].accessible).toBe(false);

    const result = await redeemCode({ ctx, stageId: q1.id, code: fixture.codes[0].code });
    expect(result).toEqual({ outcome: "UNLOCKED", codeId: fixture.codes[0].id });
    progress = await getTeamProgress(ctx);
    expect(progress.stages[0].state).toBe("COMPLETED");
    expect(progress.stages[0].accessible).toBe(false);
    expect(progress.current?.stage.id).toBe(fixture.stages[1].id);
    const db = getDb();
    const [code] = await db.select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    const [row] = await db.select().from(ahStageProgress)
      .where(and(eq(ahStageProgress.teamId, ctx.team.id), eq(ahStageProgress.stageId, q1.id)));
    expect(code).toMatchObject({ status: "USED", usedByTeamId: ctx.team.id, usedAfterStageId: q1.id });
    expect(row).toMatchObject({ challengeSolved: true, codeRedeemed: true, completed: true, redeemedCodeId: code.id });
    const audits = await db.select().from(ahAuditLogs).where(eq(ahAuditLogs.teamId, ctx.team.id));
    expect(audits.filter((a) => a.action === "code.redeemed")).toHaveLength(1);
    expect(audits.filter((a) => a.action === "stage.completed")).toHaveLength(1);
  });

  it("does not reveal code validity before the question is solved", async () => {
    const fixture = await seedFixture();
    const result = await redeemCode({ ctx: ctxFor(fixture), stageId: fixture.stages[0].id, code: fixture.codes[0].code });
    expect(result).toEqual({ outcome: "NOT_SOLVED", codeId: null });
    const [code] = await getDb().select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(code.status).toBe("ACTIVE");
  });

  it("reports a code used by another team without changing its owner", async () => {
    const fixture = await seedFixture();
    for (let index = 0; index < 2; index++) {
      await recordChallengeSolved({
        ctx: ctxFor(fixture, index), stageId: fixture.stages[0].id,
        submissionId: `submission-${index}`,
      });
    }
    expect(await redeemCode({
      ctx: ctxFor(fixture), stageId: fixture.stages[0].id, code: fixture.codes[0].code,
    })).toMatchObject({ outcome: "UNLOCKED" });
    expect(await redeemCode({
      ctx: ctxFor(fixture, 1), stageId: fixture.stages[0].id, code: fixture.codes[0].code,
    })).toEqual({ outcome: "ALREADY_USED", codeId: null });
    const [code] = await getDb().select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(code.usedByTeamId).toBe(fixture.teams[0].team.id);
  });

  it("finishes on an Accepted final question without a code", async () => {
    const fixture = await seedFixture({ stages: 1 });
    const ctx = ctxFor(fixture);
    const result = await recordChallengeSolved({ ctx, stageId: fixture.stages[0].id, submissionId: "submission-final" });
    expect(result).toEqual({ alreadySolved: false, finished: true });
    const [team] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, ctx.team.id));
    expect(team.status).toBe("FINISHED");
    expect(team.finishedAt).not.toBeNull();
    expect(await redeemCode({ ctx, stageId: fixture.stages[0].id, code: fixture.codes[0].code }))
      .toEqual({ outcome: "ALREADY_UNLOCKED", codeId: null });
  });

  it("lets exactly one of two teams win the same code", async () => {
    const fixture = await seedFixture();
    await Promise.all([0, 1].map((index) => recordChallengeSolved({
      ctx: ctxFor(fixture, index), stageId: fixture.stages[0].id, submissionId: `submission-${index}`,
    })));
    const results = await Promise.all([0, 1].map((index) => redeemCode({
      ctx: ctxFor(fixture, index), stageId: fixture.stages[0].id, code: fixture.codes[0].code,
    })));
    expect(results.map((r) => r.outcome).sort()).toEqual(["ALREADY_USED", "UNLOCKED"]);
    const [code] = await getDb().select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(code.usedByTeamId).toBe(fixture.teams[results.findIndex((r) => r.outcome === "UNLOCKED")].team.id);
    const loser = results.findIndex((r) => r.outcome === "ALREADY_USED");
    expect((await getTeamProgress(ctxFor(fixture, loser))).current?.state).toBe("CODE_PENDING");
  });

  it("uses only one of two codes submitted by one team at once", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    await recordChallengeSolved({ ctx, stageId: fixture.stages[0].id, submissionId: "submission-1" });
    const results = await Promise.all(fixture.codes.slice(0, 2).map((code) => redeemCode({
      ctx, stageId: fixture.stages[0].id, code: code.code,
    })));
    expect(results.map((r) => r.outcome).sort()).toEqual(["ALREADY_UNLOCKED", "UNLOCKED"]);
    const rows = await getDb().select().from(ahCodes);
    expect(rows.filter((row) => row.status === "USED")).toHaveLength(1);
  });

  it("makes five repeated redemptions idempotent", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    await recordChallengeSolved({ ctx, stageId: fixture.stages[0].id, submissionId: "submission-1" });
    const results = await Promise.all(Array.from({ length: 5 }, () => redeemCode({
      ctx, stageId: fixture.stages[0].id, code: fixture.codes[0].code,
    })));
    expect(results.filter((r) => r.outcome === "UNLOCKED")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "ALREADY_UNLOCKED")).toHaveLength(4);
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "stage.completed"));
    expect(audits).toHaveLength(1);
  });

  it("does not consume disabled, unknown or another event's codes", async () => {
    const fixture = await seedFixture();
    const other = await seedFixture({ codes: 3 });
    expect(other.codes[0].code).not.toBe(fixture.codes[0].code);
    const ctx = ctxFor(fixture);
    await recordChallengeSolved({ ctx, stageId: fixture.stages[0].id, submissionId: "submission-1" });
    await getDb().update(ahCodes).set({ status: "DISABLED" }).where(eq(ahCodes.id, fixture.codes[0].id));
    for (const code of [fixture.codes[0].code, "ZZZZZZZZ", other.codes[0].code]) {
      expect(await redeemCode({ ctx, stageId: fixture.stages[0].id, code }))
        .toEqual({ outcome: "INVALID", codeId: null });
    }
    const [disabled] = await getDb().select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(disabled.status).toBe("DISABLED");
  });

  it("records one solve and one audit for parallel Accepted callbacks", async () => {
    const fixture = await seedFixture();
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => recordChallengeSolved({
      ctx: ctxFor(fixture), stageId: fixture.stages[0].id, submissionId: `submission-${i}`,
    })));
    expect(results.filter((r) => !r.alreadySolved)).toHaveLength(1);
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "stage.solved"));
    expect(audits).toHaveLength(1);
  });

  it("allows a reasoned admin completion of only the current question", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    const locked = await adminCompleteStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: fixture.stages[1].id,
      adminId: "admin-1", reason: "Pool temporarily empty",
    });
    expect(locked).toMatchObject({ ok: false, code: "CONFLICT" });
    const result = await adminCompleteStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: fixture.stages[0].id,
      adminId: "admin-1", reason: "Pool temporarily empty",
    });
    expect(result).toEqual({ ok: true, changed: true, finished: false });
    expect((await getTeamProgress(ctx)).current?.stage.id).toBe(fixture.stages[1].id);
    const [row] = await getDb().select().from(ahStageProgress)
      .where(eq(ahStageProgress.stageId, fixture.stages[0].id));
    expect(row).toMatchObject({ completed: true, manualOverride: true, challengeSolved: false });
    expect((await getDb().select().from(ahCodes)).every((code) => code.status === "ACTIVE")).toBe(true);
    expect(await adminCompleteStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: fixture.stages[0].id,
      adminId: "admin-1", reason: "Repeat attempt",
    })).toMatchObject({ ok: false, code: "CONFLICT" });
    const audits = await getDb().select().from(ahAuditLogs).where(eq(ahAuditLogs.action, "override.complete_stage"));
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].metadata)).toMatchObject({ reason: "Pool temporarily empty" });
  });

  it("finishes through a manual completion of the current final question only", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    const final = fixture.stages.at(-1)!;
    expect(await adminCompleteStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: final.id,
      adminId: "admin-1", reason: "Premature attempt",
    })).toMatchObject({ ok: false, code: "CONFLICT" });
    for (const stage of fixture.stages.slice(0, -1)) {
      expect(await adminCompleteStage({
        eventId: fixture.event.id, teamId: ctx.team.id, stageId: stage.id,
        adminId: "admin-1", reason: "Judge outage",
      })).toMatchObject({ ok: true, changed: true, finished: false });
    }
    expect(await adminCompleteStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: final.id,
      adminId: "admin-1", reason: "Judge outage",
    })).toEqual({ ok: true, changed: true, finished: true });
    const [team] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, ctx.team.id));
    expect(team).toMatchObject({ status: "FINISHED" });
    expect(team.finishedAt).not.toBeNull();
    expect((await getDb().select().from(ahCodes)).every((code) => code.status === "ACTIVE")).toBe(true);
  });

  it("reverts only the latest completed question without giving a code back", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    await recordChallengeSolved({ ctx, stageId: fixture.stages[0].id, submissionId: "submission-1" });
    await redeemCode({ ctx, stageId: fixture.stages[0].id, code: fixture.codes[0].code });
    const result = await adminRevertStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: fixture.stages[0].id,
      adminId: "admin-1", reason: "Reopen after review",
    });
    expect(result).toEqual({ ok: true, changed: true });
    expect((await getTeamProgress(ctx)).current?.state).toBe("CODE_PENDING");
    const [code] = await getDb().select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(code.status).toBe("USED");
  });

  it("clears the final solve when reverting a finished team", async () => {
    const fixture = await seedFixture({ stages: 1 });
    const ctx = ctxFor(fixture);
    await recordChallengeSolved({ ctx, stageId: fixture.stages[0].id, submissionId: "submission-1" });
    const result = await adminRevertStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: fixture.stages[0].id,
      adminId: "admin-1", reason: "Judge result overturned",
    });
    expect(result).toEqual({ ok: true, changed: true });
    const [team] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, ctx.team.id));
    expect(team).toMatchObject({ status: "CHECKED_IN", finishedAt: null });
    const [row] = await getDb().select().from(ahStageProgress).where(eq(ahStageProgress.stageId, fixture.stages[0].id));
    expect(row).toMatchObject({ challengeSolved: false, completed: false, solvedSubmissionId: null });
    expect((await getTeamProgress({ ...ctx, team })).current?.stage.id).toBe(fixture.stages[0].id);
    expect(await recordChallengeSolved({
      ctx: { ...ctx, team }, stageId: fixture.stages[0].id, submissionId: "submission-2",
    })).toEqual({ alreadySolved: false, finished: true });
    const [finishedAgain] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, ctx.team.id));
    expect(finishedAgain.status).toBe("FINISHED");
  });

  it("rejects reverting an earlier completed question", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    for (const stage of fixture.stages.slice(0, 2)) {
      await adminCompleteStage({
        eventId: fixture.event.id, teamId: ctx.team.id, stageId: stage.id,
        adminId: "admin-1", reason: "Judge outage",
      });
    }
    expect(await adminRevertStage({
      eventId: fixture.event.id, teamId: ctx.team.id, stageId: fixture.stages[0].id,
      adminId: "admin-1", reason: "Out of order",
    })).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await getTeamProgress(ctx)).current?.stage.id).toBe(fixture.stages[2].id);
  });

  it("restores status after disqualification while keeping history", async () => {
    const fixture = await seedFixture();
    const ctx = ctxFor(fixture);
    expect(await disqualifyTeam({
      eventId: fixture.event.id, teamId: ctx.team.id, adminId: "admin-1", reason: "Rule violation",
    })).toEqual({ changed: true });
    const [disqualified] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, ctx.team.id));
    expect(disqualified.status).toBe("DISQUALIFIED");
    expect((await getTeamProgress({ ...ctx, team: disqualified })).current).toBeNull();
    expect(await reinstateTeam({
      eventId: fixture.event.id, teamId: ctx.team.id, adminId: "admin-1", reason: "Appeal accepted",
    })).toEqual({ changed: true });
    const [restored] = await getDb().select().from(ahTeams).where(eq(ahTeams.id, ctx.team.id));
    expect(restored.status).toBe("CHECKED_IN");
  });

  it("has no current question for a registered team even when the event is live", async () => {
    const fixture = await seedFixture({ teamStatus: "REGISTERED" });
    const progress = await getTeamProgress(ctxFor(fixture));
    expect(progress.current).toBeNull();
    expect(progress.stages.every((stage) => !stage.accessible)).toBe(true);
  });
});
