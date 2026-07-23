"use client";

import { useEffect, useState } from "react";

function msToNextMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // start of tomorrow, local time
  return next.getTime() - now.getTime();
}

/** Counts down to when the next daily problem rotates in (local midnight). */
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
