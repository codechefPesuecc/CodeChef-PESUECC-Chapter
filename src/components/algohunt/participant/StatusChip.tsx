import type { NextStepKind } from "@/lib/algohunt/types";

const CHIPS: Record<NextStepKind, { label: string; className: string }> = {
  SOLVE: { label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  FIND_CODE: { label: "Hunting", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  PAUSED: { label: "Paused", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  WAIT_FOR_START: { label: "Waiting", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  NOT_CHECKED_IN: { label: "Not checked in", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  FINISHED: { label: "Finished", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  ENDED: { label: "Ended", className: "bg-charcoal/10 text-charcoal/70" },
  DISQUALIFIED: { label: "Disqualified", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

export default function StatusChip({ kind }: { kind: NextStepKind }) {
  const chip = CHIPS[kind];
  return (
    <span className={`mecha-chip ${chip.className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {chip.label}
    </span>
  );
}
