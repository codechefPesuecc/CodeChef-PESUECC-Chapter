import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import ParticipantStateProvider from "@/components/algohunt/participant/ParticipantStateProvider";
import TeamShell from "@/components/algohunt/participant/TeamShell";
import { buildParticipantState } from "@/server/algohunt/state";
import { getCurrentTeam } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";

/** Gates every team page and hydrates the single state poller with server-built state. */
export default async function AlgoHuntTeamLayout({ children }: { children: ReactNode }) {
  const ctx = await getCurrentTeam();
  if (!ctx) redirect("/algohunt/login");
  const state = await buildParticipantState(ctx);

  return (
    <ParticipantStateProvider initial={state}>
      <TeamShell>{children}</TeamShell>
    </ParticipantStateProvider>
  );
}
