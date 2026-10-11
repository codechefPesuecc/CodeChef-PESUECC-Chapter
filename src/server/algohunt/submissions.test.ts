/**
 * Tests for src/server/algohunt/submissions.ts (unit level)
 * Module 2, brief §8
 */
import { describe, it, expect } from "vitest";
import { toSubmissionView } from "@/server/algohunt/submissions";
import type { AhSubmission } from "@/lib/algohunt/_mock-db-types";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSubmission(overrides?: Partial<AhSubmission>): AhSubmission {
  return {
    id: "sub-1",
    eventId: "evt-1",
    teamId: "team-1",
    stageId: "stage-1",
    challengeId: "ch-1",
    language: "cpp",
    code: "int main(){}",
    status: "DONE",
    verdict: "AC",
    passed: 5,
    total: 5,
    failedOn: null,
    detail: null,
    runtimeMs: 88,
    clientRequestId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: Date.now(),
    finishedAt: Date.now(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("toSubmissionView", () => {
  it("returns detail only for DONE CE rows", () => {
    const row = makeSubmission({ status: "DONE", verdict: "CE", detail: "compile_output_here" });
    const view = toSubmissionView(row, 1);
    expect(view.detail).toBe("compile_output_here");
  });

  it("returns detail only for DONE RE rows", () => {
    const row = makeSubmission({ status: "DONE", verdict: "RE", detail: "segfault" });
    const view = toSubmissionView(row, 1);
    expect(view.detail).toBe("segfault");
  });

  it("returns null detail for FAILED/ERR rows (internal message never leaks)", () => {
    const row = makeSubmission({
      status: "FAILED",
      verdict: "ERR",
      detail: "internal judge error: worker crashed",
    });
    const view = toSubmissionView(row, 1);
    expect(view.detail).toBeNull();
  });

  it("returns null detail for DONE WA rows", () => {
    const row = makeSubmission({ status: "DONE", verdict: "WA", detail: null, failedOn: 3, passed: 2, total: 5 });
    const view = toSubmissionView(row, 1);
    expect(view.detail).toBeNull();
    expect(view.failedOn).toBe(3);
    expect(view.passed).toBe(2);
  });

  it("maps all standard fields correctly", () => {
    const now = Date.now();
    const row = makeSubmission({ createdAt: now, finishedAt: now + 2000, runtimeMs: 120 });
    const view = toSubmissionView(row, 3);
    expect(view.stageNumber).toBe(3);
    expect(view.language).toBe("cpp");
    expect(view.status).toBe("DONE");
    expect(view.verdict).toBe("AC");
    expect(view.runtimeMs).toBe(120);
    expect(view.createdAt).toBe(now);
    expect(view.finishedAt).toBe(now + 2000);
  });
});
