import { describe, expect, it } from "vitest";
import type { AdminOverview } from "@/server/algohunt/admin/overview";
import {
  STUCK_WARN_MS, formatRunning, formatWaiting, longWait, lowPoolMessage, poolTone, stuckTone, systemTone,
} from "./overviewModel";

const pool = (over: Partial<AdminOverview["codePool"]> = {}): AdminOverview["codePool"] => ({
  total: 50, active: 12, used: 38, disabled: 0, teamsWaitingForCode: 0, lastRedeemedAt: null, redeemedLast10m: 0,
  lowPool: false, ...over,
});

describe("formatWaiting", () => {
  it("reads minutes, then hours", () => {
    expect(formatWaiting(20_000)).toBe("<1m");
    expect(formatWaiting(14 * 60_000 + 59_000)).toBe("14m");
    expect(formatWaiting(65 * 60_000)).toBe("1h 05m");
    expect(formatWaiting(-5)).toBe("<1m");
  });
});

describe("tones", () => {
  it("turns a stuck team amber only after 15 minutes", () => {
    expect(stuckTone(STUCK_WARN_MS)).toBe("ok");
    expect(stuckTone(STUCK_WARN_MS + 1)).toBe("warn");
  });

  it("keeps the code pool calm: amber only when low, never red, and waiting teams alone are normal", () => {
    expect(poolTone(pool())).toBe("ok");
    expect(poolTone(pool({ teamsWaitingForCode: 2 }))).toBe("ok");
    expect(poolTone(pool({ lowPool: true, active: 3, teamsWaitingForCode: 9 }))).toBe("warn");
  });

  it("flags a long wait only once some team has waited past 15 minutes", () => {
    const team = (waitingSinceMs: number) => ({
      teamId: "t", teamCode: "AH2-001", teamName: "Alpha", stageNumber: 1, waitingSinceMs,
    });
    expect(longWait([])).toBe(false);
    expect(longWait([team(STUCK_WARN_MS), team(60_000)])).toBe(false);
    expect(longWait([team(60_000), team(STUCK_WARN_MS + 1)])).toBe(true);
  });

  it("makes the system card red when the judge or DB is down, amber on judge errors", () => {
    const health = (judgeOk: boolean, dbOk: boolean): AdminOverview["health"] => ({
      judge: judgeOk
        ? { ok: true, idle: 6, busy: 2, queued: 0, workers: 8, latencyMs: 20 }
        : { ok: false, error: "Judge unreachable" },
      db: { ok: dbOk, latencyMs: 4 },
    });
    const counts = (judgeErrors10m: number) => ({ judgeErrors10m }) as AdminOverview["counts"];
    expect(systemTone({ health: health(true, true), counts: counts(0) })).toBe("ok");
    expect(systemTone({ health: health(true, true), counts: counts(2) })).toBe("warn");
    expect(systemTone({ health: health(false, true), counts: counts(0) })).toBe("bad");
    expect(systemTone({ health: health(true, false), counts: counts(0) })).toBe("bad");
  });
});

describe("lowPoolMessage", () => {
  it("is null for a healthy pool and otherwise says scarcity is by design", () => {
    expect(lowPoolMessage(pool())).toBeNull();
    expect(lowPoolMessage(pool({ lowPool: true, active: 3, teamsWaitingForCode: 9 })))
      .toBe("Only 3 active codes left. Codes are scarce by design — add more only if teams are stuck for a long time.");
    expect(lowPoolMessage(pool({ lowPool: true, active: 1, teamsWaitingForCode: 1 })))
      .toBe("Only 1 active code left. Codes are scarce by design — add more only if teams are stuck for a long time.");
  });
});

describe("formatRunning", () => {
  it("counts up from the start time and is null before it", () => {
    expect(formatRunning(null, 1_000)).toBeNull();
    expect(formatRunning(0, (3600 + 12 * 60 + 44) * 1000)).toBe("01:12:44");
    expect(formatRunning(5_000, 1_000)).toBe("00:00:00");
  });
});
