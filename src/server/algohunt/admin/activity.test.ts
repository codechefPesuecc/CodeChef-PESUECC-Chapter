import { describe, expect, it } from "vitest";
import type { AuditAction } from "@/lib/algohunt/types";
import { activityKind, describeActivity, describeSubmission, type ActivityRow } from "./activity";

const FIXTURE_CODE = "AH2-QX7Z-K9M4";
const FIXTURE_PASSWORD = "brave-otter-42";
const FIXTURE_SOURCE = "int main() { return 0; }";

function row(action: string, metadata: Record<string, unknown>, extra: Partial<ActivityRow> = {}): ActivityRow {
  return { action, metadata, targetType: "team", teamName: "Binary Bandits", actorName: "Aniket", ...extra };
}

// Contract §9.1 keys. Typed as a full Record so a new AuditAction fails to compile until it gets a case here.
const EVERY_ACTION: Record<AuditAction, Record<string, unknown>> = {
  "team.login": {},
  "team.login_failed": { teamCode: FIXTURE_CODE },
  "team.logout": {},
  "team.checked_in": { bulk: true },
  "team.password_reset": {},
  "submission.judged": { verdict: "WA", challengeId: "ch-1" },
  "stage.solved": { stageNumber: 3, submissionId: "sub-1" },
  "stage.completed": { stageNumber: 3, via: "CODE", codeSerial: 17 },
  "team.finished": { stageNumber: 6 },
  "code.redeemed": { stageNumber: 3, codeSerial: 17 },
  "code.attempt_suspicious": { invalidIn10m: 5 },
  "code.batch_created": { name: "Live batch 11:20", size: 20, serialFrom: 51, serialTo: 70 },
  "code.disabled": { serial: 17, reason: "photo leaked" },
  "code.enabled": { serial: 17, reason: "false alarm" },
  "code.batch_disabled": { batchName: "Live batch 11:20", count: 12, reason: "whole sheet leaked" },
  "code.note_updated": { serial: 17 },
  "override.complete_stage": { stageNumber: 3, reason: "QR pool empty" },
  "override.revert_stage": { stageNumber: 3, reason: "unlocked by mistake" },
  "team.disqualified": { reason: "shared answers" },
  "team.reinstated": { reason: "appeal accepted", restoredStatus: "CHECKED_IN" },
  "event.created": { slug: "ah2-2026", isTest: false },
  "event.transition": { from: "LIVE", to: "PAUSED" },
  "event.flags_changed": { changes: { codesEnabled: false }, reason: "batch leaked" },
  "stage.toggled": { stageNumber: 4, enabled: false, reason: "broken tests" },
  "announcement.created": { priority: "WARNING", preview: "Hall B wifi is down" },
  "announcement.deactivated": {},
  "volunteer.assigned": { username: "raj" },
  "volunteer.removed": { username: "raj" },
  "import.challenge": { slug: "two-sum", replaced: false },
  "import.stages": { count: 6 },
  "import.teams": { count: 40 },
  "challenge.verified": { slug: "two-sum", verified: true, wallMs: 812 },
  "export.downloaded": { type: "results" },
};

describe("describeActivity", () => {
  it.each(Object.entries(EVERY_ACTION))("%s gives a sentence without code values, passwords or source", (action, meta) => {
    const text = describeActivity(row(action, {
      ...meta, code: FIXTURE_CODE, submittedCode: FIXTURE_CODE, password: FIXTURE_PASSWORD, source: FIXTURE_SOURCE,
    }));
    expect(text.trim()).not.toBe("");
    expect(text).not.toBe(`${action} (team)`);
    for (const secret of [FIXTURE_CODE, FIXTURE_PASSWORD, FIXTURE_SOURCE]) expect(text).not.toContain(secret);
  });

  it("writes the sentences the command center shows", () => {
    expect(describeActivity(row("stage.solved", { stageNumber: 3 }))).toBe("Binary Bandits solved Question 3");
    expect(describeActivity(row("code.redeemed", { stageNumber: 3, codeSerial: 17 })))
      .toBe("Binary Bandits unlocked Question 4 with code #017");
    expect(describeActivity(row("override.complete_stage", { stageNumber: 3, reason: "QR pool empty" })))
      .toBe("Aniket unlocked Question 4 for Binary Bandits without a code: 'QR pool empty'");
    expect(describeActivity(row("code.batch_created", { name: "Live batch 11:20", size: 20, serialFrom: 51, serialTo: 70 })))
      .toBe("Aniket generated batch 'Live batch 11:20' (20 codes, #051–#070)");
    expect(describeActivity(row("event.transition", { from: "LIVE", to: "PAUSED" }))).toBe("Event paused by Aniket");
    expect(describeActivity(row("code.attempt_suspicious", { invalidIn10m: 5 })))
      .toBe("⚠ Binary Bandits entered 5 invalid codes in 10 minutes");
  });

  it("tells start from resume", () => {
    expect(describeActivity(row("event.transition", { from: "READY", to: "LIVE" }))).toBe("Event started by Aniket");
    expect(describeActivity(row("event.transition", { from: "PAUSED", to: "LIVE" }))).toBe("Event resumed by Aniket");
  });

  it("names each switch that changed", () => {
    expect(describeActivity(row("event.flags_changed", {
      changes: { submissionsEnabled: false, leaderboardVisible: true }, reason: "judge down",
    }))).toBe("Aniket turned off submissions and turned on the team leaderboard: 'judge down'");
  });

  it("falls back to action and target type for unknown actions", () => {
    expect(describeActivity(row("future.thing", { code: FIXTURE_CODE }, { targetType: "widget" })))
      .toBe("future.thing (widget)");
  });

  it("fills in missing names and metadata keys", () => {
    expect(describeActivity({ action: "stage.solved", metadata: {} })).toBe("A team solved a question");
    expect(describeActivity({ action: "team.disqualified", metadata: {} })).toBe("An admin disqualified A team");
  });
});

describe("describeSubmission", () => {
  const base = { teamName: "Binary Bandits", stageNumber: 2 };

  it("shows verdict, question and failing test", () => {
    expect(describeSubmission({ ...base, status: "DONE", verdict: "WA", failedOn: 5 }))
      .toBe("Binary Bandits got WA on Question 2 (test 5)");
    expect(describeSubmission({ ...base, status: "DONE", verdict: "AC", failedOn: null }))
      .toBe("Binary Bandits got AC on Question 2");
  });

  it("flags judge failures and pending runs", () => {
    expect(describeSubmission({ ...base, status: "FAILED", verdict: null, failedOn: null }))
      .toBe("Judge error on a submission by Binary Bandits for Question 2");
    expect(describeSubmission({ ...base, status: "RUNNING", verdict: null, failedOn: null }))
      .toBe("Binary Bandits submitted Question 2 (judging)");
  });
});

describe("activityKind", () => {
  it("buckets actions for the timeline filters", () => {
    expect(activityKind("submission.judged")).toBe("submission");
    expect(activityKind("code.redeemed")).toBe("code");
    expect(activityKind("stage.solved")).toBe("progress");
    expect(activityKind("override.complete_stage")).toBe("admin");
    expect(activityKind("future.thing")).toBe("system");
  });
});
