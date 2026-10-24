"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/algohunt/clock";
import { formatIST } from "@/lib/algohunt/format";
import { EXTEND_MINUTES, extendedEnd, parseIstInput, toIstInput } from "./controlModel";

/** Scheduled end: set it, extend it live, or remove it. Every change goes through ConfirmAction. */
export default function EndTimeCard({
  endsAt,
  disabled,
  onRequest,
}: {
  endsAt: number | null;
  disabled: boolean;
  onRequest: (next: number | null, title: string, consequences: string) => void;
}) {
  // Null until mounted: the server and the browser would otherwise render different seconds.
  const [now, setNow] = useState<number | null>(null);
  const [input, setInput] = useState(() => (endsAt === null ? "" : toIstInput(endsAt)));
  const typed = parseIstInput(input);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => setNow(Date.now());
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [endsAt]);

  const when = (ms: number) => `${formatIST(ms, { withDate: true })} IST`;
  const passed = endsAt !== null && now !== null && now >= endsAt;

  return (
    <section aria-label="Scheduled end">
      <h2 className="font-display text-lg font-bold text-chocolate">Scheduled end</h2>
      <p className="mt-1 text-sm text-charcoal/60">
        At this time runs, submissions and code entry stop for every team, and their clocks show “Time’s up”.
        The event stays LIVE until you press End event, so you can still extend it. Pausing does not move the end.
      </p>
      <div className="mt-3 space-y-4 rounded-2xl border border-hairline bg-panel p-4">
        <p className="text-sm">
          {endsAt === null ? (
            <span className="text-charcoal/70">No scheduled end. Play only stops when you end the event.</span>
          ) : (
            <>
              <span className="font-medium text-chocolate">Ends {when(endsAt)}</span>
              {now !== null && (
                <span className={`ml-2 font-mono text-xs ${passed ? "text-red-600 dark:text-red-400" : "text-charcoal/60"}`}>
                  {passed ? "· time is up, play has stopped" : `· ${formatCountdown(endsAt - now)} left`}
                </span>
              )}
            </>
          )}
        </p>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed === null) return;
            onRequest(
              typed,
              endsAt === null ? "Set the scheduled end?" : "Change the scheduled end?",
              `Play stops for every team at ${when(typed)}.${typed <= Date.now() ? " That time has already passed, so play stops immediately." : ""}`,
            );
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-charcoal/70">
            End time (IST)
            <input
              type="datetime-local"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={disabled}
              className="mecha-input h-9 font-mono text-sm"
            />
          </label>
          <button type="submit" disabled={disabled || typed === null || typed === endsAt} className="mecha-btn mecha-btn--solid mecha-btn--sm">
            {endsAt === null ? "Set end time" : "Change end time"}
          </button>
        </form>

        {endsAt !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-charcoal/70">Extend:</span>
            {EXTEND_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = extendedEnd(endsAt, Date.now(), minutes);
                  onRequest(next, `Extend by ${minutes} minutes?`, `Play stops for every team at ${when(next)} instead of ${when(endsAt)}.`);
                }}
                className="mecha-btn mecha-btn--ghost mecha-btn--sm"
              >
                +{minutes} min
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRequest(null, "Remove the scheduled end?", "Play no longer stops on its own. It stops only when you end the event.")}
              className="mecha-btn mecha-btn--ghost mecha-btn--sm ml-auto text-red-600 dark:text-red-400"
            >
              Remove end time
            </button>
          </div>
        )}
        {disabled && <p className="text-xs text-charcoal/60">The event has ended, so the end time can no longer change.</p>}
      </div>
    </section>
  );
}
