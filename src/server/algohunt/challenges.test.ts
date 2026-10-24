/**
 * Tests for challenges.ts and GET /api/algohunt/challenges/current
 * (Module 2, brief §8 tests 14–16)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toChallengeView } from "@/server/algohunt/challenges";
import { makeChallenge, makeStage, makeCtx, makeStageWithProgress, makeTeamProgress } from "@/server/algohunt/testing/fixtures";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/server/algohunt/teamSession", () => ({
  requireTeam: vi.fn(),
  getCurrentTeam: vi.fn(),
  AH_TEAM_COOKIE: "ah_team",
}));

vi.mock("@/server/algohunt/access", () => ({
  getTeamProgress: vi.fn(),
  assertTeamCanPlay: vi.fn(),
}));

vi.mock("@/server/algohunt/challenges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/algohunt/challenges")>();
  return {
    ...actual,
    getStageChallenge: vi.fn(),
    loadJudgeInput: vi.fn(),
    allowedLanguages: vi.fn().mockReturnValue([{ id: "cpp", label: "C++ (g++ 20)" }]),
  };
});

vi.mock("@/server/rateLimit", () => ({
  enforceRateLimits: vi.fn().mockResolvedValue(null),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import * as teamSession from "@/server/algohunt/teamSession";
import * as access from "@/server/algohunt/access";
import * as challenges from "@/server/algohunt/challenges";
import { GET } from "@/app/api/algohunt/challenges/current/route";
import type { TeamContext } from "@/server/algohunt/teamSession";
import type { StageChallenge } from "@/server/algohunt/challenges";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(): Request {
  return new Request("http://localhost/api/algohunt/challenges/current", {
    method: "GET",
    headers: { origin: "http://localhost" },
  });
}

function mockTeamSession(ctx: TeamContext | null) {
  if (!ctx) {
    vi.mocked(teamSession.requireTeam).mockImplementation(async () => {
      const { fail } = await import("@/server/algohunt/http");
      return fail("UNAUTHENTICATED");
    });
  } else {
    vi.mocked(teamSession.requireTeam).mockResolvedValue(ctx as unknown as Awaited<ReturnType<typeof teamSession.requireTeam>>);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

// Test 14: toChallengeView does NOT include secrets
describe("toChallengeView", () => {
  it("output does not contain test data, reference code, editorial, or author", () => {
    const ch = makeChallenge({
      referenceSolution: JSON.stringify({ language: "cpp", code: "SECRET_REF_CODE" }),
      bruteSolution: JSON.stringify({ language: "python", code: "SECRET_BRUTE" }),
      editorial: "SECRET_EDITORIAL_TEXT",
      author: "SECRET_AUTHOR_NAME",
      samples: JSON.stringify([{ input: "1 2\n", output: "3\n" }]),
      contentHtml: JSON.stringify({
        statement: "<p>Add two numbers.</p>",
        inputFormat: "",
        outputFormat: "",
        constraints: "",
        sampleExplanations: [""],
      }),
    });
    const stage = makeStage({ isFinal: false });
    const sc: StageChallenge = { stage, challenge: ch };
    const view = toChallengeView(sc, { solved: false });
    const json = JSON.stringify(view);

    expect(json).not.toContain("SECRET_REF_CODE");
    expect(json).not.toContain("SECRET_BRUTE");
    expect(json).not.toContain("SECRET_EDITORIAL_TEXT");
    expect(json).not.toContain("SECRET_AUTHOR_NAME");
    // Should contain the statement
    expect(view.html.statement).toContain("Add two numbers");
    // Samples should be present (they're public)
    expect(view.samples).toHaveLength(1);
    expect(view.samples[0].input).toBe("1 2\n");
  });

  it("includes required public fields", () => {
    const ch = makeChallenge({ title: "Sum Two", difficulty: "Easy", timeLimit: "1s", memoryLimit: "128MB" });
    const stage = makeStage({ stageNumber: 2, isFinal: false });
    const sc: StageChallenge = { stage, challenge: ch };
    const view = toChallengeView(sc, { solved: true });

    expect(view.stageNumber).toBe(2);
    expect(view.title).toBe("Sum Two");
    expect(view.difficulty).toBe("Easy");
    expect(view.solved).toBe(true);
    expect(view.timeLimitMs).toBeGreaterThan(0);
    expect(view.memoryLimitMb).toBeGreaterThan(0);
  });
});

// Test 15 & 16: GET /challenges/current
describe("GET /api/algohunt/challenges/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Q1 at start of event", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const stage1 = makeStage({ id: "stage-1", stageNumber: 1, isFinal: false });
    const ch1 = makeChallenge({ id: "ch-1", title: "Q1 Problem" });
    const swp1 = makeStageWithProgress(stage1, "Q1 Problem", null, true, false);
    const progress = makeTeamProgress([swp1], swp1);
    vi.mocked(access.getTeamProgress).mockResolvedValue(progress);
    vi.mocked(challenges.getStageChallenge).mockResolvedValue({ stage: stage1, challenge: ch1 });
    vi.mocked(challenges.allowedLanguages).mockReturnValue([{ id: "cpp", label: "C++ (g++ 20)" }]);

    // Inline toChallengeView to avoid re-mocking
    vi.mocked(challenges.getStageChallenge).mockResolvedValue({ stage: stage1, challenge: ch1 });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.challenge).not.toBeNull();
  });

  it("returns EVENT_NOT_LIVE for READY event status", async () => {
    const ctx = makeCtx({ event: { status: "READY" } });
    mockTeamSession(ctx);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("EVENT_NOT_LIVE");
  });

  it("returns EVENT_ENDED for ENDED event status", async () => {
    const ctx = makeCtx({ event: { status: "ENDED" } });
    mockTeamSession(ctx);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("EVENT_ENDED");
  });

  it("returns TEAM_NOT_CHECKED_IN for REGISTERED team in LIVE event", async () => {
    const ctx = makeCtx({ team: { status: "REGISTERED" } });
    mockTeamSession(ctx);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TEAM_NOT_CHECKED_IN");
  });

  it("returns TEAM_DISQUALIFIED for DQ team", async () => {
    const ctx = makeCtx({ team: { status: "DISQUALIFIED" } });
    mockTeamSession(ctx);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TEAM_DISQUALIFIED");
  });

  it("never returns Q1 again after team moves to Q2", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    // Q1 is completed, Q2 is current
    const stage1 = makeStage({ id: "stage-1", stageNumber: 1, isFinal: false });
    const stage2 = makeStage({ id: "stage-2", stageNumber: 2, isFinal: false, challengeId: "ch-2" });
    const ch2 = makeChallenge({ id: "ch-2", title: "Q2 Problem" });
    const sp1 = { challengeSolved: true, codeRedeemed: true, completed: true, completedAt: Date.now(), challengeSolvedAt: Date.now(), solvedSubmissionId: "sub-1", codeRedeemedAt: Date.now(), redeemedCodeId: "code-1", completionRequestId: "req-1", manualOverride: false, overrideReason: null, overrideBy: null, id: "sp-1", eventId: "evt-1", teamId: "team-1", stageId: "stage-1", createdAt: Date.now(), updatedAt: Date.now() };
    const swp1 = makeStageWithProgress(stage1, "Q1 Problem", sp1, false, true);
    const swp2 = makeStageWithProgress(stage2, "Q2 Problem", null, true, false);
    const progress = makeTeamProgress([swp1, swp2], swp2);
    vi.mocked(access.getTeamProgress).mockResolvedValue(progress);
    vi.mocked(challenges.getStageChallenge).mockResolvedValue({ stage: stage2, challenge: ch2 });

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(true);
    // Must be Q2, never Q1
    expect(json.challenge).not.toBeNull();
  });

  it("returns challenge: null for a finished team", async () => {
    const ctx = makeCtx({ team: { status: "FINISHED" } });
    mockTeamSession(ctx);
    const stage1 = makeStage({ stageNumber: 1, isFinal: true });
    const sp1 = { challengeSolved: true, codeRedeemed: false, completed: true, completedAt: Date.now(), challengeSolvedAt: Date.now(), solvedSubmissionId: "sub-f", codeRedeemedAt: null, redeemedCodeId: null, completionRequestId: "req-f", manualOverride: false, overrideReason: null, overrideBy: null, id: "sp-f", eventId: "evt-1", teamId: "team-1", stageId: "stage-1", createdAt: Date.now(), updatedAt: Date.now() };
    const swp1 = makeStageWithProgress(stage1, "Final Problem", sp1, false, true);
    const progress = makeTeamProgress([swp1], null, { finished: true });
    vi.mocked(access.getTeamProgress).mockResolvedValue(progress);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.challenge).toBeNull();
  });
});
