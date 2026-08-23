"use client";

import QRCodeDisplay from "@/components/monstr/QRCodeDisplay";
import StartContestButton from "@/components/monstr/StartContestButton";
import ParticipantMonitor from "@/components/monstr/ParticipantMonitor";
import ExportButton from "@/components/monstr/ExportButton";

interface Problem {
  id: string;
  title: string;
  timeLimit: string | null;
  memoryLimit: string | null;
}

interface Props {
  contestId: string;
  title: string;
  joinCode: string;
  durationMinutes: number;
  startedAt: number | null;
  problems: Problem[];
  joinUrl: string;
}

export default function ContestManager({
  contestId,
  title,
  joinCode,
  durationMinutes,
  startedAt,
  problems,
  joinUrl,
}: Props) {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
  };

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-bronze">
            Contest management
          </p>
          <h1 className="font-display text-3xl font-bold text-chocolate">
            {title}
          </h1>
          <p className="text-sm text-charcoal/60 mt-2">
            {problems.length} problem{problems.length === 1 ? "" : "s"} ·{" "}
            {durationMinutes} minutes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Join Code */}
          <div className="mecha-wrapper space-y-3">
            <h2 className="text-lg font-semibold">Join Code</h2>
            <div className="p-4 bg-cream/20 dark:bg-white/5 rounded font-mono text-2xl font-bold text-center text-chocolate">
              {joinCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="mecha-btn w-full text-sm"
            >
              Copy code
            </button>
          </div>

          {/* QR Code */}
          <div className="mecha-wrapper space-y-3">
            <h2 className="text-lg font-semibold">QR Code</h2>
            <QRCodeDisplay url={joinUrl} />
          </div>
        </div>

        {/* Start Button */}
        <div className="mecha-wrapper mb-8">
          <StartContestButton
            contestId={contestId}
            isStarted={!!startedAt}
          />
        </div>

        {/* Problems List */}
        <div className="mecha-wrapper mb-8">
          <h2 className="text-lg font-semibold mb-4">Problems</h2>
          {problems.length === 0 ? (
            <p className="text-sm text-charcoal/60">No problems yet.</p>
          ) : (
            <div className="space-y-2">
              {problems.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded"
                >
                  <div>
                    <p className="font-medium">
                      Problem {idx + 1}: {p.title}
                    </p>
                    <p className="text-xs text-charcoal/60">
                      {p.timeLimit && `${p.timeLimit}`}
                      {p.memoryLimit && ` · ${p.memoryLimit}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participant Monitor (only show after started) */}
        {startedAt && <ParticipantMonitor contestId={contestId} />}

        {/* Export Button */}
        <ExportButton
          contestId={contestId}
          contestTitle={title}
        />
      </section>
    </main>
  );
}
