"use client";

import { KeyRound, QrCode } from "lucide-react";
import Link from "@/components/AppLink";
import CodeEntry from "@/components/algohunt/code/CodeEntry";
import type { CurrentStageView, RedeemResult } from "@/lib/algohunt/types";

/**
 * The dashboard's code box. While a code is pending it is M3's CodeEntry itself, focused, so a
 * team back from the hunt can type straight away; otherwise a link to the Enter code page.
 */
export default function CodeEntrySlot({
  teamCode,
  current,
  canPlay,
  disabledReason,
  onResult,
}: {
  teamCode: string;
  current: CurrentStageView;
  canPlay: boolean;
  disabledReason: string | null;
  onResult: (r: RedeemResult) => void;
}) {
  if (current.state === "CODE_PENDING") {
    return (
      <CodeEntry
        key={current.number}
        teamCode={teamCode}
        stageNumber={current.number}
        isFinal={current.isFinal}
        state={current.state}
        canPlay={canPlay}
        disabledReason={disabledReason ?? undefined}
        autoFocus
        onResult={onResult}
      />
    );
  }
  return (
    <div className="lc-panel space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <QrCode aria-hidden className="h-4 w-4 text-bronze" />
        Enter the code from a QR to unlock Question {current.number + 1}
      </p>
      <p className="text-xs text-charcoal/70">Solve Question {current.number} first. Codes you already found keep until then.</p>
      {canPlay ? (
        <Link href="/algohunt/code" className="mecha-btn w-full">
          <KeyRound aria-hidden className="h-4 w-4" />
          Enter code
        </Link>
      ) : (
        <p className="text-sm text-charcoal/70">{disabledReason}</p>
      )}
    </div>
  );
}
