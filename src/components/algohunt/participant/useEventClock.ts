"use client";

import { useEffect, useState } from "react";
import { countdownLevel, isTimeUp, type CountdownLevel } from "@/lib/algohunt/clock";
import { useParticipantState } from "./ParticipantStateProvider";

export interface EventClock {
  /** Server time now, ticking every second. offset = serverNow − Date.now() is re-taken on every poll. */
  now: number;
  endsAt: number | null;
  msLeft: number | null;
  level: CountdownLevel | null;
  /** True from the scheduled end, without waiting for the next poll. The server enforces it anyway. */
  timeUp: boolean;
}

export function useEventClock(): EventClock {
  const { state } = useParticipantState();
  const { serverNow } = state;
  const { endsAt } = state.event;
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const offset = serverNow - Date.now();
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [serverNow]);

  // A fresh poll can carry a later serverNow than the last tick; never run the clock backwards.
  const current = Math.max(now, serverNow);
  const msLeft = endsAt === null ? null : endsAt - current;
  return {
    now: current,
    endsAt,
    msLeft,
    level: msLeft === null ? null : countdownLevel(msLeft),
    timeUp: isTimeUp(endsAt, current),
  };
}
