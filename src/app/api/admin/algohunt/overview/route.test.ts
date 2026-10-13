process.env.DATABASE_URL = ":memory:";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { judgeHealth } from "@/lib/judge";
import { resetAlgoHuntTables, setupTestDb } from "@/server/algohunt/testing/db";
import { createSiteUser, seedFixture } from "@/server/algohunt/testing/fixtures";
import { clearCookies, setSiteSessionCookie } from "@/server/algohunt/testing/next-headers-mock";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/server/algohunt/testing/next-headers-mock"));
vi.mock("@/lib/judge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/judge")>()),
  judgeHealth: vi.fn(),
}));

beforeAll(setupTestDb);
beforeEach(async () => {
  clearCookies();
  await resetAlgoHuntTables();
  vi.mocked(judgeHealth).mockResolvedValue({
    total_workers: 8, idle_workers: 6, busy_workers: 2, queued_jobs: 0, uptime_secs: 100,
  });
});

describe("GET overview", () => {
  it("returns the snapshot for the named event with no-store, and 404 for an unknown event", async () => {
    const fixture = await seedFixture({ teams: 2 });
    setSiteSessionCookie((await createSiteUser({ isAdmin: true })).id);

    const response = await GET(new Request(`https://chapter.example/x?event=${fixture.event.slug}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: true,
      event: { slug: fixture.event.slug },
      counts: { teamsTotal: 2, checkedIn: 2 },
      health: { judge: { ok: true } },
    });

    const missing = await GET(new Request("https://chapter.example/x?event=no-such-event"));
    expect(missing.status).toBe(404);
  });
});
