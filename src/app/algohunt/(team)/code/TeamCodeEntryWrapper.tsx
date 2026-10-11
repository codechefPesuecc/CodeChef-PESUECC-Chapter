"use client";

import { useRouter } from "next/navigation";
import CodeEntry, { type CodeEntryProps } from "@/components/algohunt/code/CodeEntry";
import { useParticipantState } from "@/components/algohunt/participant/ParticipantStateProvider";

export function TeamCodeEntryWrapper(props: Omit<CodeEntryProps, "onResult">) {
  const router = useRouter();
  const participant = useParticipantState();

  return (
    <CodeEntry
      {...props}
      onResult={() => {
        router.refresh();
        participant.refresh();
      }}
    />
  );
}
