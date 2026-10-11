import { readinessIssues, type Readiness } from "./controlModel";

/** "Questions 6 · Unverified 0 · Final ✓ · Active codes 50 · Checked in 38". Red when something is off. */
export default function ReadinessStrip({ readiness }: { readiness: Readiness }) {
  const issues = readinessIssues(readiness);
  const bad = issues.length > 0;
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        bad ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/10"
      }`}
    >
      <p className="font-mono text-xs text-chocolate">
        Questions {readiness.stages} · Unverified {readiness.challengesUnverified} · Final{" "}
        {readiness.finalStageOk ? "✓" : "✗"} · Active codes {readiness.activeCodes} · Checked in {readiness.checkedInTeams}
      </p>
      {bad && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-red-700 dark:text-red-300">
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
    </div>
  );
}
