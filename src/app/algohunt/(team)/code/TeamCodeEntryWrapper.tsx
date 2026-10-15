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
  // The page decided canPlay when it rendered; the polled state follows pauses, resumes and the end.
  const liveReason = playBlockReason(participant.state, "code", timeUp);

  return (
    <CodeEntry
      {...props}
      canPlay={liveReason === null}
      disabledReason={liveReason ?? undefined}
      onResult={() => {
        router.refresh();
        participant.refresh();
      }}
    />
  );
}
