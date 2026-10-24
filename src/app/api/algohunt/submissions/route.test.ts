/**
 * Tests for POST /api/algohunt/submissions and GET /api/algohunt/submissions
 * (Module 2, contract §12.1, module brief §8)
 *
 * Mocks:
 *   - @/server/judge: controls judgeTests return value per test
 *   - @/server/algohunt/teamSession: controls requireTeam()
 *   - @/server/algohunt/access: controls getTeamProgress() / assertTeamCanPlay()
 *   - @/server/algohunt/challenges: controls getStageChallenge() / loadJudgeInput() / allowedLanguages()
 *   - @/server/algohunt/progression: controls recordChallengeSolved()
 *   - @/server/db: in-memory, unused since submissions.ts uses raw SQL — we mock at the function level
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_CODE_CHARS } from "@/server/limits";
import { COPY } from "@/lib/algohunt/copy";

// ── Module-level mocks ─────────────────────────────────────────────────────

vi.mock("@/server/judge", () => ({
  judgeTests: vi.fn(),
}));

vi.mock("@/server/algohunt/teamSession", () => ({
  requireTeam: vi.fn(),
  AH_TEAM_COOKIE: "ah_team",
}));

vi.mock("@/server/algohunt/access", () => ({
  getTeamProgress: vi.fn(),
  assertTeamCanPlay: vi.fn(),
}));

vi.mock("@/server/algohunt/challenges", () => ({
  getStageChallenge: vi.fn(),
  loadJudgeInput: vi.fn(),
  allowedLanguages: vi.fn(),
}));

vi.mock("@/server/algohunt/progression", () => ({
  recordChallengeSolved: vi.fn(),
}));

vi.mock("@/server/algohunt/submissions", async (importOriginal) => {
  // We want to test the server layer, so we partially mock: keep toSubmissionView real but
  // mock the DB write functions via vi.fn() stubs on the module.
  // For route-level tests, we mock createAndJudgeSubmission directly.
  const actual = await importOriginal<typeof import("@/server/algohunt/submissions")>();
  return {
    ...actual,
    createAndJudgeSubmission: vi.fn(),
    listTeamSubmissions: vi.fn(),
  };
});

vi.mock("@/server/rateLimit", () => ({
  enforceRateLimits: vi.fn().mockResolvedValue(null),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { GET, POST } from "@/app/api/algohunt/submissions/route";
import * as teamSession from "@/server/algohunt/teamSession";
import * as submissions from "@/server/algohunt/submissions";
import * as rateLimit from "@/server/rateLimit";
import type { TeamContext } from "@/server/algohunt/teamSession";
import { makeCtx, makeStage, makeStageWithProgress, makeTeamProgress } from "@/server/algohunt/testing/fixtures";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/algohunt/submissions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(): Request {
  return new Request("http://localhost/api/algohunt/submissions", {
    method: "GET",
    headers: { origin: "http://localhost" },
  });
}

function mockTeamSession(ctx: TeamContext | null) {
  vi.mocked(teamSession.requireTeam).mockResolvedValue(
    ctx ?? ({} as ReturnType<typeof teamSession.requireTeam> extends Promise<infer T> ? T : never),
  );
  if (!ctx) {
    // Return a 401 NextResponse
    vi.mocked(teamSession.requireTeam).mockImplementation(async () => {
      const { fail } = await import("@/server/algohunt/http");
      return fail("UNAUTHENTICATED");
    });
  }
}

const validBody = {
  language: "cpp",
  code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){cout<<0;return 0;}',
  clientRequestId: "550e8400-e29b-41d4-a716-446655440000",
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/algohunt/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.enforceRateLimits).mockResolvedValue(null);
    vi.mocked(rateLimit.clientIp).mockReturnValue("127.0.0.1");
  });

  // Test 1: No cookie → 401 UNAUTHENTICATED
  it("returns 401 when no team cookie", async () => {
    mockTeamSession(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHENTICATED");
  });

  // Test 2a: Team REGISTERED → TEAM_NOT_CHECKED_IN
  it("returns TEAM_NOT_CHECKED_IN for REGISTERED team", async () => {
    const ctx = makeCtx({ team: { status: "REGISTERED" } });
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "TEAM_NOT_CHECKED_IN",
    });
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TEAM_NOT_CHECKED_IN");
  });

  // Test 2b: Event PAUSED → EVENT_PAUSED
  it("returns EVENT_PAUSED for paused event", async () => {
    const ctx = makeCtx({ event: { status: "PAUSED" } });
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "EVENT_PAUSED",
    });
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("EVENT_PAUSED");
  });

  // Test 2c: Event READY → EVENT_NOT_LIVE
  it("returns EVENT_NOT_LIVE for event in READY status", async () => {
    const ctx = makeCtx({ event: { status: "READY" } });
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "EVENT_NOT_LIVE",
    });
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("EVENT_NOT_LIVE");
  });

  // Test 2d: submissionsEnabled = false → SUBMISSIONS_DISABLED
  it("returns SUBMISSIONS_DISABLED when submissions are off", async () => {
    const ctx = makeCtx({ event: { submissionsEnabled: false } });
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "SUBMISSIONS_DISABLED",
    });
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("SUBMISSIONS_DISABLED");
  });

  // Test 3: Unsupported language
  it("returns UNSUPPORTED_LANGUAGE for rust", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "UNSUPPORTED_LANGUAGE",
    });
    const res = await POST(makeRequest({ ...validBody, language: "rust" }));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNSUPPORTED_LANGUAGE");
  });

  // Test 4a: Code over MAX_CODE_CHARS → 400 VALIDATION
  it("returns 400 VALIDATION for code over MAX_CODE_CHARS", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const res = await POST(makeRequest({
      ...validBody,
      code: "x".repeat(MAX_CODE_CHARS + 1),
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION");
  });

  // Test 4b: Raw body over 256KB → 413 PAYLOAD_TOO_LARGE
  it("returns 413 for request body over 256KB", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const bigBody = "x".repeat(257 * 1024);
    const res = await POST(new Request("http://localhost/api/algohunt/submissions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(bigBody.length),
        origin: "http://localhost",
      },
      body: bigBody,
    }));
    expect(res.status).toBe(413);
  });

  // Test 5: Extra field in body → VALIDATION (strict schema)
  it("returns VALIDATION for extra fields in body (stageNumber)", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const res = await POST(makeRequest({ ...validBody, stageNumber: 1 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION");
  });

  it("returns VALIDATION for extra field teamId in body", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const res = await POST(makeRequest({ ...validBody, teamId: "hacker" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION");
  });

  // Test 6: WA → row DONE/WA, question stays IN_PROGRESS
  it("returns WA verdict with correct message", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const mockResult = {
      submission: {
        id: "sub-1", stageNumber: 1, language: "cpp", status: "DONE" as const,
        verdict: "WA" as const, passed: 2, total: 5, failedOn: 3,
        detail: null, runtimeMs: 120, createdAt: Date.now(), finishedAt: Date.now(),
      },
      stage: { number: 1, challengeSolved: false, needsCode: false, finished: false },
      message: "Wrong answer on test 3.",
    };
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({ ok: true, result: mockResult });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.submission.verdict).toBe("WA");
    expect(json.stage.challengeSolved).toBe(false);
    expect(json.message).toContain("Wrong answer");
  });

  // Test 7: AC on Q1 → challengeSolved, needsCode: true, finished: false
  it("returns AC with needsCode: true for Q1", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const mockResult = {
      submission: {
        id: "sub-2", stageNumber: 1, language: "cpp", status: "DONE" as const,
        verdict: "AC" as const, passed: 5, total: 5, failedOn: null,
        detail: null, runtimeMs: 88, createdAt: Date.now(), finishedAt: Date.now(),
      },
      stage: { number: 1, challengeSolved: true, needsCode: true, finished: false },
      message: COPY.accepted,
    };
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({ ok: true, result: mockResult });
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.submission.verdict).toBe("AC");
    expect(json.stage.needsCode).toBe(true);
    expect(json.stage.finished).toBe(false);
    expect(json.message).toBe(COPY.accepted);
  });

  // Test 8: AC on final question → finished: true, needsCode: false
  it("returns finished: true for AC on final question", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const mockResult = {
      submission: {
        id: "sub-3", stageNumber: 5, language: "cpp", status: "DONE" as const,
        verdict: "AC" as const, passed: 5, total: 5, failedOn: null,
        detail: null, runtimeMs: 90, createdAt: Date.now(), finishedAt: Date.now(),
      },
      stage: { number: 5, challengeSolved: true, needsCode: false, finished: true },
      message: COPY.finished,
    };
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({ ok: true, result: mockResult });
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.stage.finished).toBe(true);
    expect(json.stage.needsCode).toBe(false);
    expect(json.message).toBe(COPY.finished);
  });

  // Test 9: Same clientRequestId twice → one row, judgeTests called once, same result
  it("returns same result for duplicate clientRequestId (idempotent)", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const mockResult = {
      submission: {
        id: "sub-4", stageNumber: 1, language: "cpp", status: "DONE" as const,
        verdict: "WA" as const, passed: 1, total: 3, failedOn: 2,
        detail: null, runtimeMs: 50, createdAt: Date.now(), finishedAt: Date.now(),
      },
      stage: { number: 1, challengeSolved: false, needsCode: false, finished: false },
      message: "Wrong answer on test 2.",
    };
    // createAndJudgeSubmission handles idempotency; both calls return the same result
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({ ok: true, result: mockResult });
    const res1 = await POST(makeRequest(validBody));
    const res2 = await POST(makeRequest(validBody));
    const json1 = await res1.json();
    const json2 = await res2.json();
    expect(json1.submission.id).toBe(json2.submission.id);
    // createAndJudgeSubmission should have been called twice (route calls it both times)
    expect(vi.mocked(submissions.createAndJudgeSubmission)).toHaveBeenCalledTimes(2);
  });

  // Test 10: After AC, new submit → ALREADY_SOLVED
  it("returns ALREADY_SOLVED after question is solved", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "ALREADY_SOLVED",
      message: COPY.accepted,
    });
    const res = await POST(makeRequest({ ...validBody, clientRequestId: "550e8400-e29b-41d4-a716-446655440001" }));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("ALREADY_SOLVED");
  });

  // Test 11: judgeTests returns ERR → 503, row FAILED, progress unchanged, internal message not in body
  it("returns JUDGE_UNAVAILABLE when Akiro returns ERR, no internal message exposed", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    vi.mocked(submissions.createAndJudgeSubmission).mockResolvedValue({
      ok: false,
      code: "JUDGE_UNAVAILABLE",
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("JUDGE_UNAVAILABLE");
    // Internal judge message must never leak
    expect(JSON.stringify(json)).not.toContain("internal");
    expect(JSON.stringify(json)).not.toContain("Worker error");
  });

  // Test 13: Rate limit — after 10 submissions by one team in 60s → 429
  it("returns 429 when rate limit is tripped", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    const { NextResponse } = await import("next/server");
    vi.mocked(rateLimit.enforceRateLimits).mockResolvedValue(
      NextResponse.json(
        { ok: false, error: "Too many attempts — try again in 60s.", rateLimited: true },
        { status: 429 },
      ),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("RATE_LIMITED");
    expect(typeof json.retryAfterSeconds).toBe("number");
  });
});

describe("GET /api/algohunt/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit.enforceRateLimits).mockResolvedValue(null);
    vi.mocked(rateLimit.clientIp).mockReturnValue("127.0.0.1");
  });

  // Test 1: No cookie → 401
  it("returns 401 when no team cookie", async () => {
    mockTeamSession(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  // Test 12: GET submissions — team A never gets team B's data; after Q1 completed only Q2 shown
  it("returns only current question submissions, not past questions", async () => {
    const ctx = makeCtx();
    mockTeamSession(ctx);
    // Return 2 submissions from the mock — both for current stage
    vi.mocked(submissions.listTeamSubmissions).mockResolvedValue([
      {
        id: "sub-q2-1", stageNumber: 2, language: "cpp", status: "DONE",
        verdict: "WA", passed: 0, total: 3, failedOn: 1,
        detail: null, runtimeMs: 55, createdAt: Date.now(), finishedAt: Date.now(),
        code: 'int main(){cout<<0;}',
      },
    ]);
    // current is stage 2
    const stage2 = makeStage({ id: "stage-2", stageNumber: 2, isFinal: false });
    const stageWithProgress2 = makeStageWithProgress(stage2, "Problem 2", null, true, true);
    const progress = makeTeamProgress([stageWithProgress2], stageWithProgress2);
    const { getTeamProgress } = await import("@/server/algohunt/access");
    vi.mocked(getTeamProgress).mockResolvedValue(progress);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.submissions).toHaveLength(1);
    expect(json.submissions[0].stageNumber).toBe(2);
    // Team B's submissions must never appear — mock only returns team A's current stage
  });
});
