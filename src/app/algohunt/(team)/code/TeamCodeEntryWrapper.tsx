"use client";

import { useRouter } from "next/navigation";
import CodeEntry, { type CodeEntryProps } from "@/components/algohunt/code/CodeEntry";
import { useParticipantState } from "@/components/algohunt/participant/ParticipantStateProvider";
import { useEventClock } from "@/components/algohunt/participant/useEventClock";
import { playBlockReason } from "@/lib/algohunt/play";

export function TeamCodeEntryWrapper(props: Omit<CodeEntryProps, "onResult">) {
  const router = useRouter();
  const participant = useParticipantState();
  const { timeUp } = useEventClock();
  // The page rendered with the state at load time; the polled state follows solves, unlocks,
  // pauses, resumes and the end, so a team that opened this page early isn't stuck.
  const liveReason = playBlockReason(participant.state, "code", timeUp);
  const current = participant.state.current;
  const stageNumber = current?.number ?? props.stageNumber;

  return (
    <CodeEntry
      {...props}
      stageNumber={stageNumber}
      isFinal={current?.isFinal ?? props.isFinal}
      state={current?.state ?? props.state}
      canPlay={liveReason === null}
      disabledReason={liveReason ?? undefined}
      onResult={() => {
        router.refresh();
        participant.refresh();
      }}
    />
  );
}
