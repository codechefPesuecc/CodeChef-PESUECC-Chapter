import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/server/db";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: mocks.getDb }));

import { auditInsert, writeAudit } from "./audit";

const base = {
  eventId: "event-1",
  actorType: "SYSTEM" as const,
  actorId: null,
  action: "team.login_failed" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auditInsert", () => {
  it("removes secret metadata keys and bounds strings", () => {
    let values: Record<string, unknown> | undefined;
    const db = {
      insert: () => ({ values: (row: Record<string, unknown>) => {
        values = row;
        return Promise.resolve();
      } }),
    } as unknown as AppDatabase;

    auditInsert(db, {
      ...base,
      userAgent: "a".repeat(400),
      metadata: {
        teamCode: "AH2-T001",
        password: "hidden",
        code: "hidden",
        submittedCode: "hidden",
        secret: "hidden",
        source: "hidden",
        nested: { password: "also hidden", note: "x".repeat(600) },
      },
    });

    expect(values?.userAgent).toHaveLength(300);
    expect(JSON.parse(values?.metadata as string)).toEqual({
      teamCode: "AH2-T001",
      nested: { note: "x".repeat(500) },
    });
  });
});

describe("writeAudit", () => {
  it("logs an insert failure without throwing", async () => {
    const error = new Error("database unavailable");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getDb.mockReturnValue({
      insert: () => ({ values: () => Promise.reject(error) }),
    });
    await expect(writeAudit(base)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith("[algohunt:audit]", error);
    consoleSpy.mockRestore();
  });
});
