"use client";

import { KeyRound, QrCode } from "lucide-react";
import Link from "@/components/AppLink";

/**
 * TODO(CodeEntry): replace this placeholder card with M3's CodeEntry from
 * src/components/algohunt/code/CodeEntry.tsx once it is on the algohunt branch:
 *   <CodeEntry teamCode stageNumber={current.number} isFinal state={current.state}
 *     canPlay disabledReason onResult={() => refresh()} />
 * expanded and autofocused in CODE_PENDING, collapsed otherwise, hidden on the final question.
 */
export default function CodeEntrySlot({
  stageNumber,
  canPlay,
  disabledReason,
}: {
  stageNumber: number;
  canPlay: boolean;
  disabledReason: string | null;
}) {
  return (
    <div className="lc-panel space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <QrCode aria-hidden className="h-4 w-4 text-bronze" />
        Enter the code from a QR to unlock Question {stageNumber + 1}
      </p>
      {canPlay ? (
        <Link href="/algohunt/code" className="mecha-btn mecha-btn--solid w-full">
          <KeyRound aria-hidden className="h-4 w-4" />
          Enter code
        </Link>
      ) : (
        <p className="text-sm text-charcoal/70">{disabledReason}</p>
      )}
    </div>
  );
}
