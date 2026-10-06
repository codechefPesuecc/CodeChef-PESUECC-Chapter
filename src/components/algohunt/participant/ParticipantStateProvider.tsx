"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/algohunt/copy";
import type { ParticipantState } from "@/lib/algohunt/types";
import { usePoll } from "../usePoll";

interface ParticipantStateValue {
  state: ParticipantState;
  online: boolean;
  lastUpdated: number | null;
  refresh: () => void;
}

const ParticipantStateContext = createContext<ParticipantStateValue | null>(null);

/**
 * The ONLY team-state poller in the participant app (contract §11). Pages and other
 * modules read useParticipantState() and call refresh() instead of polling themselves.
 */
export default function ParticipantStateProvider({
  initial,
  children,
}: {
  initial: ParticipantState;
  children: ReactNode;
}) {
  const router = useRouter();
  const poll = usePoll<ParticipantState>("/api/algohunt/state", { intervalMs: 8000, jitterMs: 1500 });
  // Session gone (expired, password reset, logged out elsewhere): send the team back to log in
  // instead of showing stale state. Fires once per transition, not on every repeated 401.
  const sessionLost = poll.error === COPY.errors.UNAUTHENTICATED;
  useEffect(() => {
    if (!sessionLost) return;
    router.replace("/algohunt/login");
    router.refresh();
  }, [sessionLost, router]);

  const value: ParticipantStateValue = {
    state: poll.data ?? initial,
    online: poll.online,
    lastUpdated: poll.lastUpdated ?? initial.serverNow,
    refresh: poll.refresh,
  };
  return <ParticipantStateContext.Provider value={value}>{children}</ParticipantStateContext.Provider>;
}

export function useParticipantState(): ParticipantStateValue {
  const value = useContext(ParticipantStateContext);
  if (!value) throw new Error("useParticipantState must be used inside the AlgoHunt team layout.");
  return value;
}
