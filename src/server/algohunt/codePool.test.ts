process.env.DATABASE_URL = ":memory:";

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { POST as redeemRoute } from "@/app/api/algohunt/codes/redeem/route";
import { isWellFormedCode } from "@/lib/algohunt/codes";
import { getDb } from "@/server/db";
import {
  ahAuditLogs,
  ahCodeAttempts,
  ahCodes,
  ahEvents,
  ahStageProgress,
  ahTeams,
} from "@/server/db/schema";
import {
  createCodeBatch,
  disableBatch,
  getCodePoolStats,
  redeemCodeForTeam,
  setCodeAvailability,
} from "./codePool";
import { resetAlgoHuntTables, setupTestDb } from "./testing/db";
import { ctxFor, seedFixture, solveCurrent } from "./testing/fixtures";

// AsyncLocalStorage cookie jar to enable concurrent per-team requests in Promise.all
const asyncCookieStore = new AsyncLocalStorage<Map<string, string>>();
const defaultJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const store = asyncCookieStore.getStore() ?? defaultJar;
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      const store = asyncCookieStore.getStore() ?? defaultJar;
      store.set(name, value);
    },
    delete(name: string) {
      const store = asyncCookieStore.getStore() ?? defaultJar;
      store.delete(name);
    },
    getAll(name?: string) {
      const store = asyncCookieStore.getStore() ?? defaultJar;
      return [...store.entries()]
        .filter(([key]) => !name || key === name)
        .map(([key, value]) => ({ name: key, value }));
    },
  }),
}));

function teamToken(teamId: string, epoch = 0): string {
  const secret = process.env.AUTH_SECRET || "dev-insecure-change-me-in-production";
  const key = crypto.createHmac("sha256", secret).update("algohunt-team-cookie-v1").digest();
  const payload = `ahteam:v1:${teamId}:${epoch}:${Date.now() + 86_400_000}`;
  const signature = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function setTeamCookieMock(teamId: string, epoch = 0) {
  defaultJar.set("ah_team", teamToken(teamId, epoch));
}

function runAsTeam<T>(teamId: string, epoch: number, fn: () => Promise<T>): Promise<T> {
  const store = new Map<string, string>();
  store.set("ah_team", teamToken(teamId, epoch));
  return asyncCookieStore.run(store, fn);
}

beforeAll(setupTestDb);
beforeEach(async () => {
  defaultJar.clear();
  await resetAlgoHuntTables();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("AlgoHunt Code Pool & Redemption Engine (Module 3)", () => {
  // Test 1
  it("1. createCodeBatch 50 -> 50 unique well-formed codes, serials 1-50, all ACTIVE, one batch row, and an audit row without code values. A second batch continues at 51. Size 0 or 201 -> VALIDATION. ENDED event -> EVENT_ENDED", async () => {
    const fixture = await seedFixture({ codes: 0 });
    const eventId = fixture.event.id;

    // Size validation
    const invalidZero = await createCodeBatch({ eventId, name: "Zero", size: 0, adminId: "admin-1" });
    expect(invalidZero).toMatchObject({ ok: false, code: "VALIDATION" });
    const invalidOver = await createCodeBatch({ eventId, name: "Over", size: 201, adminId: "admin-1" });
    expect(invalidOver).toMatchObject({ ok: false, code: "VALIDATION" });

    // Valid batch 1 (size 50)
    const b1 = await createCodeBatch({ eventId, name: "Batch 1", size: 50, adminId: "admin-1" });
    expect(b1.ok).toBe(true);
    if (!b1.ok) return;

    expect(b1.batch.name).toBe("Batch 1");
    expect(b1.codes).toHaveLength(50);
    expect(b1.codes[0].serial).toBe(1);
    expect(b1.codes[49].serial).toBe(50);

    const codeSet = new Set<string>();
    for (const c of b1.codes) {
      expect(isWellFormedCode(c.code)).toBe(true);
      codeSet.add(c.code);
    }
    expect(codeSet.size).toBe(50);

    const db = getDb();
    const dbCodes = await db.select().from(ahCodes).where(eq(ahCodes.eventId, eventId));
    expect(dbCodes).toHaveLength(50);
    expect(dbCodes.every((c) => c.status === "ACTIVE")).toBe(true);

    // Verify audit log has no code values
    const auditRows = await db
      .select()
      .from(ahAuditLogs)
      .where(and(eq(ahAuditLogs.eventId, eventId), eq(ahAuditLogs.action, "code.batch_created")));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].metadata).not.toContain(b1.codes[0].code);
    expect(auditRows[0].metadata).toContain('"serialFrom":1');
    expect(auditRows[0].metadata).toContain('"serialTo":50');

    // Second batch continues at serial 51
    const b2 = await createCodeBatch({ eventId, name: "Batch 2", size: 10, adminId: "admin-1" });
    expect(b2.ok).toBe(true);
    if (!b2.ok) return;
    expect(b2.codes[0].serial).toBe(51);
    expect(b2.codes[9].serial).toBe(60);

    // ENDED event check
    await db.update(ahEvents).set({ status: "ENDED" }).where(eq(ahEvents.id, eventId));
    const endedRes = await createCodeBatch({ eventId, name: "Batch 3", size: 10, adminId: "admin-1" });
    expect(endedRes).toMatchObject({ ok: false, code: "EVENT_ENDED" });
  });

  // Test 2
  it("2. Redeem before solving -> CHALLENGE_NOT_SOLVED. The code is still ACTIVE. A NOT_SOLVED attempt is logged and not counted toward the cooldown", async () => {
    const fixture = await seedFixture({ codes: 2 });
    const ctx = ctxFor(fixture);
    const code = fixture.codes[0].code;

    const res = await redeemCodeForTeam({ ctx, rawCode: code, ip: "127.0.0.1" });
    expect(res).toMatchObject({ ok: false, code: "CHALLENGE_NOT_SOLVED" });

    const db = getDb();
    const [codeRow] = await db.select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(codeRow.status).toBe("ACTIVE");

    const attempts = await db.select().from(ahCodeAttempts).where(eq(ahCodeAttempts.teamId, ctx.team.id));
    expect(attempts).toHaveLength(1);
    expect(attempts[0].result).toBe("NOT_SOLVED");
  });

  // Test 3
  it("3. Solve Q1, redeem a valid code -> UNLOCKED, unlockedStageNumber: 2, message 'Question 2 is now unlocked'. The code is USED by the team", async () => {
    const fixture = await seedFixture({ codes: 2 });
    const ctx = ctxFor(fixture);
    await solveCurrent(fixture);

    const code = fixture.codes[0].code;
    const res = await redeemCodeForTeam({ ctx, rawCode: code, ip: "127.0.0.1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.result.result).toBe("UNLOCKED");
    expect(res.result.unlockedStageNumber).toBe(2);
    expect(res.result.message).toContain("Question 2 is now unlocked");

    const db = getDb();
    const [codeRow] = await db.select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    expect(codeRow.status).toBe("USED");
    expect(codeRow.usedByTeamId).toBe(ctx.team.id);

    const attempts = await db.select().from(ahCodeAttempts).where(eq(ahCodeAttempts.teamId, ctx.team.id));
    expect(attempts).toHaveLength(1);
    expect(attempts[0].result).toBe("UNLOCKED");
    expect(attempts[0].codeId).toBe(fixture.codes[0].id);
  });

  // Test 4
  it("4. Another team redeems the same code -> ALREADY_USED. Not counted toward the cooldown", async () => {
    const fixture = await seedFixture({ codes: 2, teams: 2 });
    const ctx1 = ctxFor(fixture, 0);
    const ctx2 = ctxFor(fixture, 1);

    await solveCurrent(fixture, 0);
    await solveCurrent(fixture, 1);

    const code = fixture.codes[0].code;
    const r1 = await redeemCodeForTeam({ ctx: ctx1, rawCode: code, ip: "127.0.0.1" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.result.result).toBe("UNLOCKED");

    const r2 = await redeemCodeForTeam({ ctx: ctx2, rawCode: code, ip: "127.0.0.2" });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.result.result).toBe("ALREADY_USED");
    expect(r2.result.invalidAttemptsLeft).toBeNull();

    const db = getDb();
    const attempts2 = await db.select().from(ahCodeAttempts).where(eq(ahCodeAttempts.teamId, ctx2.team.id));
    expect(attempts2).toHaveLength(1);
    expect(attempts2[0].result).toBe("ALREADY_USED");
  });

  // Test 5
  it("5. Unknown, disabled and malformed (7-char) codes -> INVALID with invalidAttemptsLeft 4, 3, 2, 1, 0. The next attempt -> COOLDOWN (429, retryAfterSeconds > 0). Advance 10 min -> allowed again. COOLDOWN rows don't extend the window", async () => {
    const fixture = await seedFixture({ codes: 5 });
    const ctx = ctxFor(fixture);
    await solveCurrent(fixture);

    // Disable code 0
    await getDb()
      .update(ahCodes)
      .set({ status: "DISABLED" })
      .where(eq(ahCodes.id, fixture.codes[0].id));

    const invalidInputs = [
      fixture.codes[0].code, // disabled code -> INVALID (left = 4)
      "XXXXXXXX", // unknown code -> INVALID (left = 3)
      "7FQ2M8K", // malformed 7-char -> INVALID (left = 2)
      "YYYYYYYY", // unknown code -> INVALID (left = 1)
      "ZZZZZZZZ", // unknown code -> INVALID (left = 0)
    ];

    const expectedLeft = [4, 3, 2, 1, 0];
    for (let i = 0; i < invalidInputs.length; i++) {
      const res = await redeemCodeForTeam({ ctx, rawCode: invalidInputs[i], ip: "127.0.0.1" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.result.result).toBe("INVALID");
      expect(res.result.invalidAttemptsLeft).toBe(expectedLeft[i]);
    }

    // 6th attempt -> COOLDOWN
    const cooldownRes = await redeemCodeForTeam({ ctx, rawCode: "WWWWWWWW", ip: "127.0.0.1" });
    expect(cooldownRes.ok).toBe(false);
    if (cooldownRes.ok) return;
    expect(cooldownRes.code).toBe("COOLDOWN");
    expect(cooldownRes.retryAfterSeconds).toBeGreaterThan(0);

    // Advance 10 minutes (600,001 ms) using fake timers
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 600_001);

    // Should be allowed again now (not COOLDOWN)
    const allowedAgain = await redeemCodeForTeam({ ctx, rawCode: "UNKNOWN1", ip: "127.0.0.1" });
    expect(allowedAgain.ok).toBe(true);
    if (!allowedAgain.ok) return;
    expect(allowedAgain.result.result).toBe("INVALID");
    expect(allowedAgain.result.invalidAttemptsLeft).toBe(4);
  });

  // Test 6
  it("6. ' 7fq2-m8k3 ' matches 7FQ2M8K3 (normalization)", async () => {
    const fixture = await seedFixture({ codes: 2 });
    const ctx = ctxFor(fixture);
    await solveCurrent(fixture);

    // Set code in db to known uppercase
    const targetCode = "7FQ2M8K3";
    await getDb()
      .update(ahCodes)
      .set({ code: targetCode })
      .where(eq(ahCodes.id, fixture.codes[0].id));

    const res = await redeemCodeForTeam({ ctx, rawCode: " 7fq2-m8k3 ", ip: "127.0.0.1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.result).toBe("UNLOCKED");
  });

  // Test 7
  it("7. On the final question -> CHALLENGE_NOT_SOLVED with the 'no code needed' message. After finishing -> TEAM_FINISHED", async () => {
    const fixture = await seedFixture({ stages: 2, codes: 2 });
    const ctx = ctxFor(fixture);

    // Stage 1 solved & redeemed -> unlocks Stage 2 (final question)
    await solveCurrent(fixture);
    await redeemCodeForTeam({ ctx, rawCode: fixture.codes[0].code, ip: "127.0.0.1" });

    // Now on final question (Stage 2)
    const resFinal = await redeemCodeForTeam({ ctx, rawCode: fixture.codes[1].code, ip: "127.0.0.1" });
    expect(resFinal).toMatchObject({
      ok: false,
      code: "CHALLENGE_NOT_SOLVED",
      message: "The final question needs no code. Solve it to finish AlgoHunt 2.0!",
    });

    // Solving final question marks team FINISHED
    await solveCurrent(fixture);
    fixture.teams[0].team.status = "FINISHED";

    // Now team is FINISHED
    const resAfterFinish = await redeemCodeForTeam({ ctx, rawCode: fixture.codes[1].code, ip: "127.0.0.1" });
    expect(resAfterFinish).toMatchObject({
      ok: false,
      code: "TEAM_FINISHED",
    });
  });

  // Test 8
  it("8. PAUSED -> EVENT_PAUSED. codesEnabled = false -> CODES_DISABLED", async () => {
    const fixture = await seedFixture({ codes: 2 });
    const ctx = ctxFor(fixture);
    await solveCurrent(fixture);

    // Pause event
    const db = getDb();
    ctx.event.status = "PAUSED";
    await db.update(ahEvents).set({ status: "PAUSED" }).where(eq(ahEvents.id, fixture.event.id));

    const resPaused = await redeemCodeForTeam({ ctx, rawCode: fixture.codes[0].code, ip: "127.0.0.1" });
    expect(resPaused).toMatchObject({ ok: false, code: "EVENT_PAUSED" });

    // Unpause but disable codes
    ctx.event.status = "LIVE";
    ctx.event.codesEnabled = false;
    await db.update(ahEvents).set({ status: "LIVE", codesEnabled: false }).where(eq(ahEvents.id, fixture.event.id));

    const resDisabled = await redeemCodeForTeam({ ctx, rawCode: fixture.codes[0].code, ip: "127.0.0.1" });
    expect(resDisabled).toMatchObject({ ok: false, code: "CODES_DISABLED" });
  });

  // Test 9
  it("9. A body with an extra teamId field -> VALIDATION (.strict())", async () => {
    const fixture = await seedFixture({ codes: 2 });
    setTeamCookieMock(fixture.teams[0].team.id, fixture.teams[0].team.sessionEpoch);

    const req = new Request("https://chapter.example/api/algohunt/codes/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: fixture.codes[0].code, teamId: "smuggled-id" }),
    });

    const res = await redeemRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  // Test 10
  it("10. Race through the route: two teams, both on CODE_PENDING, redeem the same code in Promise.all -> one UNLOCKED, one ALREADY_USED", async () => {
    const fixture = await seedFixture({ codes: 2, teams: 2 });
    await solveCurrent(fixture, 0);
    await solveCurrent(fixture, 1);

    const code = fixture.codes[0].code;

    const [res1, res2] = await Promise.all([
      runAsTeam(fixture.teams[0].team.id, fixture.teams[0].team.sessionEpoch, async () => {
        const req = new Request("https://chapter.example/api/algohunt/codes/redeem", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
          body: JSON.stringify({ code }),
        });
        return (await redeemRoute(req)).json();
      }),
      runAsTeam(fixture.teams[1].team.id, fixture.teams[1].team.sessionEpoch, async () => {
        const req = new Request("https://chapter.example/api/algohunt/codes/redeem", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.2" },
          body: JSON.stringify({ code }),
        });
        return (await redeemRoute(req)).json();
      }),
    ]);

    const results = [res1.result, res2.result];
    expect(results).toContain("UNLOCKED");
    expect(results).toContain("ALREADY_USED");
  });

  // Test 11
  it("11. One team, two phones, two different codes in Promise.all -> one UNLOCKED, one ALREADY_UNLOCKED. The second code is still ACTIVE. Sequential too: phone 1 unlocks; 5 s later phone 2 enters another valid code -> ALREADY_UNLOCKED (not CHALLENGE_NOT_SOLVED), unlockedStageNumber = the new question, and that code is still ACTIVE. 2 minutes later the same request -> CHALLENGE_NOT_SOLVED", async () => {
    const fixture = await seedFixture({ stages: 3, codes: 5 });
    const ctx = ctxFor(fixture, 0);
    await solveCurrent(fixture, 0);

    const codeA = fixture.codes[0].code;
    const codeB = fixture.codes[1].code;

    // Concurrent two phones with two different codes
    const [r1, r2] = await Promise.all([
      redeemCodeForTeam({ ctx, rawCode: codeA, ip: "10.0.0.1" }),
      redeemCodeForTeam({ ctx, rawCode: codeB, ip: "10.0.0.2" }),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    const outcomes = [r1.result.result, r2.result.result];
    expect(outcomes).toContain("UNLOCKED");
    expect(outcomes).toContain("ALREADY_UNLOCKED");

    // The code corresponding to ALREADY_UNLOCKED must still be ACTIVE
    const db = getDb();
    const [rowA] = await db.select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[0].id));
    const [rowB] = await db.select().from(ahCodes).where(eq(ahCodes.id, fixture.codes[1].id));
    const activeCount = [rowA.status, rowB.status].filter((s) => s === "ACTIVE").length;
    const usedCount = [rowA.status, rowB.status].filter((s) => s === "USED").length;
    expect(activeCount).toBe(1);
    expect(usedCount).toBe(1);

    // Sequential test:
    // Create new fixture for clean sequential test
    const fixtureSeq = await seedFixture({ stages: 3, codes: 5 });
    const ctxSeq = ctxFor(fixtureSeq, 0);
    await solveCurrent(fixtureSeq, 0);

    vi.useFakeTimers();
    const startTime = 1_700_000_000_000;
    vi.setSystemTime(startTime);

    // Phone 1 unlocks at t = 0
    const seqUnlock = await redeemCodeForTeam({
      ctx: ctxSeq,
      rawCode: fixtureSeq.codes[0].code,
      ip: "10.0.0.1",
    });
    expect(seqUnlock.ok).toBe(true);
    if (!seqUnlock.ok) return;
    expect(seqUnlock.result.result).toBe("UNLOCKED");

    // 5 seconds later phone 2 enters code 1
    vi.setSystemTime(startTime + 5_000);
    const seq5s = await redeemCodeForTeam({
      ctx: ctxSeq,
      rawCode: fixtureSeq.codes[1].code,
      ip: "10.0.0.2",
    });
    expect(seq5s.ok).toBe(true);
    if (!seq5s.ok) return;
    expect(seq5s.result.result).toBe("ALREADY_UNLOCKED");
    expect(seq5s.result.unlockedStageNumber).toBe(2);

    const [seqCode1Row] = await db.select().from(ahCodes).where(eq(ahCodes.id, fixtureSeq.codes[1].id));
    expect(seqCode1Row.status).toBe("ACTIVE");

    // 2 minutes later (120,000 ms) the same request with another valid code
    vi.setSystemTime(startTime + 125_000);
    const seq2m = await redeemCodeForTeam({
      ctx: ctxSeq,
      rawCode: fixtureSeq.codes[2].code,
      ip: "10.0.0.2",
    });
    expect(seq2m).toMatchObject({
      ok: false,
      code: "CHALLENGE_NOT_SOLVED",
    });
  });

  // Test 12
  it("12. No team response ever contains any pool code other than the one typed (check the JSON string against all fixture codes)", async () => {
    const fixture = await seedFixture({ codes: 5 });
    const ctx = ctxFor(fixture);
    await solveCurrent(fixture);

    const typedCode = fixture.codes[0].code;
    const res = await redeemCodeForTeam({ ctx, rawCode: typedCode, ip: "127.0.0.1" });
    const jsonString = JSON.stringify(res);

    for (let i = 1; i < fixture.codes.length; i++) {
      expect(jsonString).not.toContain(fixture.codes[i].code);
    }
  });

  // Test 13
  it("13. getCodePoolStats: the counts match. teamsWaitingForCode counts only CHECKED_IN teams in CODE_PENDING on non-final questions", async () => {
    const fixture = await seedFixture({ stages: 3, teams: 4, codes: 10 });
    const db = getDb();

    // Team 0: CHECKED_IN, solves Q1 (non-final) -> CODE_PENDING -> should be counted in teamsWaitingForCode
    await solveCurrent(fixture, 0);

    // Team 1: CHECKED_IN, on Q1, not solved -> not waiting
    // Team 2: Set status to REGISTERED (not checked in), solved Q1 -> should NOT be counted
    await db.update(ahTeams).set({ status: "REGISTERED" }).where(eq(ahTeams.id, fixture.teams[2].team.id));
    fixture.teams[2].team.status = "REGISTERED";
    await db.insert(ahStageProgress).values({
      id: crypto.randomUUID(),
      eventId: fixture.event.id,
      teamId: fixture.teams[2].team.id,
      stageId: fixture.stages[0].id,
      challengeSolved: true,
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Team 3: Advance to final question (stage 3) and solve it -> final question doesn't need code -> not waiting
    await solveCurrent(fixture, 3);
    await redeemCodeForTeam({ ctx: ctxFor(fixture, 3), rawCode: fixture.codes[0].code, ip: "1.1.1.1" });
    await solveCurrent(fixture, 3);
    await redeemCodeForTeam({ ctx: ctxFor(fixture, 3), rawCode: fixture.codes[1].code, ip: "1.1.1.1" });
    // Now on stage 3 (final). Even if solved, it's final.
    await solveCurrent(fixture, 3);

    // Disable code 2
    await db.update(ahCodes).set({ status: "DISABLED" }).where(eq(ahCodes.id, fixture.codes[2].id));

    const stats = await getCodePoolStats(fixture.event.id);
    expect(stats.total).toBe(10);
    expect(stats.used).toBe(2);
    expect(stats.disabled).toBe(1);
    expect(stats.active).toBe(7);
    expect(stats.teamsWaitingForCode).toBe(1); // Only Team 0
    expect(stats.redeemedLast10m).toBe(2);
    expect(stats.lastRedeemedAt).not.toBeNull();
  });

  // Test 14
  it("14. setCodeAvailability: DISABLE an ACTIVE code -> redeem -> INVALID. ENABLE -> redeem works. DISABLE/ENABLE on a USED code -> CONFLICT. disableBatch disables only ACTIVE codes and returns the count", async () => {
    const fixture = await seedFixture({ codes: 4 });
    const ctx = ctxFor(fixture);
    await solveCurrent(fixture);

    const code0 = fixture.codes[0];

    // DISABLE an ACTIVE code
    const disRes = await setCodeAvailability({
      codeId: code0.id,
      action: "DISABLE",
      reason: "Lost voucher slip",
      adminId: "admin-1",
    });
    expect(disRes.ok).toBe(true);

    // Redeem disabled code -> INVALID
    const redeemDis = await redeemCodeForTeam({ ctx, rawCode: code0.code, ip: "127.0.0.1" });
    expect(redeemDis.ok).toBe(true);
    if (!redeemDis.ok) return;
    expect(redeemDis.result.result).toBe("INVALID");

    // ENABLE the code again
    const enRes = await setCodeAvailability({
      codeId: code0.id,
      action: "ENABLE",
      reason: "Voucher found safely",
      adminId: "admin-1",
    });
    expect(enRes.ok).toBe(true);

    // Redeem works now -> UNLOCKED
    const redeemEn = await redeemCodeForTeam({ ctx, rawCode: code0.code, ip: "127.0.0.1" });
    expect(redeemEn.ok).toBe(true);
    if (!redeemEn.ok) return;
    expect(redeemEn.result.result).toBe("UNLOCKED");

    // DISABLE/ENABLE on a USED code -> CONFLICT
    const disUsed = await setCodeAvailability({
      codeId: code0.id,
      action: "DISABLE",
      reason: "Trying to disable used",
      adminId: "admin-1",
    });
    expect(disUsed).toMatchObject({ ok: false, code: "CONFLICT" });

    // disableBatch disables only ACTIVE codes
    // In fixture.batch, code 0 is USED, codes 1, 2, 3 are ACTIVE
    const batchDisRes = await disableBatch({
      batchId: fixture.batch.id,
      reason: "Sheet lost on campus",
      adminId: "admin-1",
    });
    expect(batchDisRes.disabled).toBe(3);

    const db = getDb();
    const codesInBatch = await db.select().from(ahCodes).where(eq(ahCodes.batchId, fixture.batch.id));
    const usedInBatch = codesInBatch.filter((c) => c.status === "USED");
    const disabledInBatch = codesInBatch.filter((c) => c.status === "DISABLED");
    expect(usedInBatch).toHaveLength(1);
    expect(disabledInBatch).toHaveLength(3);
  });
});
