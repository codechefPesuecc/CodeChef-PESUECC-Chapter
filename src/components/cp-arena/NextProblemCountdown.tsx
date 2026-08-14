"use client";

import { useEffect, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Milliseconds until the next IST midnight, when the Problem of the Day rotates
 * in. Uses the epoch (not the viewer's local clock) so it matches the server's
 * IST rollover regardless of the visitor's own timezone.
 */
function msToNextMidnight(): number {
  const istNow = Date.now() + IST_OFFSET_MS;
  const sinceIstMidnight = ((istNow % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - sinceIstMidnight;
}

/** Counts down to when the next daily problem rotates in (IST midnight). */
export default function NextProblemCountdown() {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMs(msToNextMidnight());
    const initial = setTimeout(tick, 0); // async so it doesn't set state in the effect body
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  if (ms === null) return null;
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");

  return (
    <span className="font-mono text-xs text-charcoal/50">
      Next problem in {hh}:{mm}:{ss}
    </span>
  );
}
