process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { seedFixture, solveCurrent } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setTeamCookie } from "@/server/algohunt/testing/next-headers-mock";
import { POST } from "./route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
});

function postRedeem(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://chapter.example/api/algohunt/codes/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.42",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/algohunt/codes/redeem route", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await postRedeem({ code: "7FQ2M8K3" });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("rejects requests with unknown fields in body (.strict())", async () => {
    const fixture = await seedFixture({ codes: 2 });
    setTeamCookie(fixture.teams[0].team.id, fixture.teams[0].team.sessionEpoch);

    const res = await postRedeem({
      code: fixture.codes[0].code,
      extraField: "hack",
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("rejects non-JSON requests", async () => {
    const fixture = await seedFixture({ codes: 2 });
    setTeamCookie(fixture.teams[0].team.id, fixture.teams[0].team.sessionEpoch);

    const res = await POST(
      new Request("https://chapter.example/api/algohunt/codes/redeem", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "7FQ2M8K3",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("redeems successfully when current question is solved", async () => {
    const fixture = await seedFixture({ codes: 2 });
    setTeamCookie(fixture.teams[0].team.id, fixture.teams[0].team.sessionEpoch);
    await solveCurrent(fixture, 0);

    const res = await postRedeem({ code: fixture.codes[0].code });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      ok: true,
      result: "UNLOCKED",
      unlockedStageNumber: 2,
    });
  });

  it("enforces team rate limits (8 requests per 60s)", async () => {
    const fixture = await seedFixture({ codes: 15 });
    setTeamCookie(fixture.teams[0].team.id, fixture.teams[0].team.sessionEpoch);
    await solveCurrent(fixture, 0);

    // Make 8 requests
    for (let i = 0; i < 8; i++) {
      const res = await postRedeem(
        { code: "UNKNOWNX" },
        { "x-forwarded-for": `198.51.100.${i + 1}` }, // vary IP so IP limit is not tripped first
      );
      expect([200, 429]).toContain(res.status);
    }

    // 9th request should be rate limited
    const res9 = await postRedeem(
      { code: "UNKNOWNX" },
      { "x-forwarded-for": "198.51.100.99" },
    );
    expect(res9.status).toBe(429);
    const data = await res9.json();
    expect(data).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(res9.headers.get("Retry-After")).not.toBeNull();
  });
});
