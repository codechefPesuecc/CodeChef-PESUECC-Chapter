import { describe, expect, it } from "vitest";
import type { AdminOverview } from "@/server/algohunt/admin/overview";
import {
  STUCK_WARN_MS, formatRunning, formatWaiting, lowPoolMessage, poolTone, stuckTone, systemTone,
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

  it("makes the code pool red when low and amber when teams wait", () => {
    expect(poolTone(pool())).toBe("ok");
    expect(poolTone(pool({ teamsWaitingForCode: 2 }))).toBe("warn");
    expect(poolTone(pool({ lowPool: true, active: 3, teamsWaitingForCode: 9 }))).toBe("bad");
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
  it("is null for a healthy pool and names the numbers otherwise", () => {
    expect(lowPoolMessage(pool())).toBeNull();
    expect(lowPoolMessage(pool({ lowPool: true, active: 12, teamsWaitingForCode: 9 })))
      .toBe("LOW POOL: 12 active codes, 9 teams waiting. Generate & print a new batch.");
    expect(lowPoolMessage(pool({ lowPool: true, active: 1, teamsWaitingForCode: 1 })))
      .toBe("LOW POOL: 1 active code, 1 team waiting. Generate & print a new batch.");
  });
});

describe("formatRunning", () => {
  it("counts up from the start time and is null before it", () => {
    expect(formatRunning(null, 1_000)).toBeNull();
    expect(formatRunning(0, (3600 + 12 * 60 + 44) * 1000)).toBe("01:12:44");
    expect(formatRunning(5_000, 1_000)).toBe("00:00:00");
  });
});
