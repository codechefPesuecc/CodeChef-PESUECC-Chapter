import { redirect } from "next/navigation";
import { getCurrentTeam } from "@/server/algohunt/teamSession";
import { getTeamProgress } from "@/server/algohunt/access";
import { COPY } from "@/lib/algohunt/copy";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import Link from "@/components/AppLink";
import SubmissionList from "@/components/algohunt/challenge/SubmissionList";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const ctx = await getCurrentTeam();
  if (!ctx) redirect("/algohunt/login");

  const { event, team } = ctx;

  // Status gates
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <MechaPanel label="SUBMISSIONS">
          <div className="px-6 py-8 text-center">
            <p className="text-chocolate dark:text-cream">{COPY.ended}</p>
          </div>
        </MechaPanel>
      </div>
    );
  }

  if (team.status === "REGISTERED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <MechaPanel label="SUBMISSIONS">
          <div className="px-6 py-8 text-center">
            <p className="text-chocolate dark:text-cream">{COPY.notCheckedIn}</p>
          </div>
        </MechaPanel>
      </div>
    );
  }

  const progress = await getTeamProgress(ctx);

  if (progress.finished || !progress.current) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <MechaPanel label="SUBMISSIONS">
          <div className="space-y-4 px-6 py-8 text-center">
            <p className="font-semibold text-chocolate dark:text-cream">{COPY.finished}</p>
            <p className="text-sm text-charcoal/60 dark:text-cream/60">
              Earlier questions can&apos;t be reopened.
            </p>
            <Link href="/algohunt/leaderboard" className="mecha-btn mecha-btn--primary inline-block">
              View Leaderboard
            </Link>
          </div>
        </MechaPanel>
      </div>
    );
  }

  const cur = progress.current;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-chocolate dark:text-cream">
          Your submissions for Question {cur.stage.stageNumber}
        </h1>
        <Link href="/algohunt/challenge" className="text-sm text-bronze hover:underline">
          ← Back to Question
        </Link>
      </div>
      <p className="mb-4 text-xs text-charcoal/50 dark:text-cream/50">
        Earlier questions can&apos;t be reopened. Only the current question&apos;s submissions are shown.
      </p>
      <SubmissionList stageNumber={cur.stage.stageNumber} teamCode={team.teamCode} />
    </div>
  );
}
