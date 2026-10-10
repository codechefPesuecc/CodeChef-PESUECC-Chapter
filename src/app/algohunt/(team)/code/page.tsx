import { redirect } from "next/navigation";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { COPY } from "@/lib/algohunt/copy";
import { assertTeamCanPlay, getTeamProgress } from "@/server/algohunt/access";
import { getCurrentTeam } from "@/server/algohunt/teamSession";
import { TeamCodeEntryWrapper } from "./TeamCodeEntryWrapper";

export const dynamic = "force-dynamic";

export default async function AlgoHuntCodePage() {
  const ctx = await getCurrentTeam();
  if (!ctx) {
    redirect("/algohunt/login");
  }

  const { event, team } = ctx;

  // State panels (not started / not checked in / finished / DQ / ended) using COPY
  if (event.status === "DRAFT" || event.status === "CHECK_IN" || event.status === "READY") {
    return (
      <MechaPanel label="NOT STARTED" index="AH 2.0">
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-charcoal/80">{COPY.notStarted}</p>
        </div>
      </MechaPanel>
    );
  }

  if (team.status === "REGISTERED") {
    return (
      <MechaPanel label="CHECK-IN REQUIRED" index="AH 2.0">
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-charcoal/80">{COPY.notCheckedIn}</p>
        </div>
      </MechaPanel>
    );
  }

  if (team.status === "DISQUALIFIED") {
    return (
      <MechaPanel label="DISQUALIFIED" index="AH 2.0">
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-rose-700 font-semibold">{COPY.disqualified}</p>
        </div>
      </MechaPanel>
    );
  }

  if (team.status === "FINISHED") {
    return (
      <MechaPanel label="FINISHED" index="AH 2.0">
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-emerald-800 font-semibold">{COPY.finished}</p>
        </div>
      </MechaPanel>
    );
  }

  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return (
      <MechaPanel label="EVENT ENDED" index="AH 2.0">
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-charcoal/80">{COPY.ended}</p>
        </div>
      </MechaPanel>
    );
  }

  const progress = await getTeamProgress(ctx);
  const cur = progress.current;
  const playBlock = assertTeamCanPlay(ctx, "code");
  const canPlay = playBlock === null;
  const disabledReason = playBlock?.message;

  if (!cur) {
    if (event.status === "PAUSED") {
      return (
        <MechaPanel label="PAUSED" index="AH 2.0">
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-amber-800">{COPY.paused}</p>
          </div>
        </MechaPanel>
      );
    }
    return (
      <MechaPanel label="CODE ENTRY" index="AH 2.0">
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-charcoal/80">No active question at this time.</p>
        </div>
      </MechaPanel>
    );
  }

  return (
    <div className="space-y-4">
      {event.status === "PAUSED" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-900">
          {COPY.paused}
        </div>
      )}
      <TeamCodeEntryWrapper
        teamCode={team.teamCode}
        stageNumber={cur.stage.stageNumber}
        isFinal={cur.stage.isFinal}
        state={cur.state}
        canPlay={canPlay}
        disabledReason={disabledReason}
      />
    </div>
  );
}
