import { describe, expect, it } from "vitest";
import { assertTeamCanPlay } from "@/server/algohunt/access";
import { makeEvent, makeTeam } from "@/server/algohunt/testing/fixtures";
import { EVENT_STATUSES, TEAM_STATUSES } from "./types";
import { playBlockReason } from "./play";

describe("playBlockReason", () => {
  it("gives the same answer as the server's assertTeamCanPlay for every combination", () => {
    const now = Date.now();
    for (const status of EVENT_STATUSES) {
      for (const teamStatus of TEAM_STATUSES) {
        for (const endsAt of [null, now + 60_000, now - 1]) {
          for (const submissionsEnabled of [true, false]) {
            for (const codesEnabled of [true, false]) {
              const event = makeEvent({ status, endsAt, submissionsEnabled, codesEnabled });
              const team = makeTeam({ status: teamStatus });
              for (const action of ["submit", "run", "code"] as const) {
                const server = assertTeamCanPlay({ event, team }, action, now)?.message ?? null;
                const client = playBlockReason(
                  { event: { status, submissionsEnabled, codesEnabled }, team: { status: teamStatus } },
                  action,
                  endsAt !== null && now >= endsAt,
                );
                expect(client, `${status}/${teamStatus}/${endsAt}/${submissionsEnabled}/${codesEnabled}/${action}`).toBe(server);
              }
            }
          }
        }
      }
    }
  });
});
