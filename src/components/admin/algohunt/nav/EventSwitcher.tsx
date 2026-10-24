"use client";

import { useId } from "react";
import { STATUS_TONE_CLASS, statusTone, type NavEvent } from "./navModel";

export default function EventSwitcher({
  events, selected, onSelect,
}: {
  events: readonly NavEvent[];
  selected: NavEvent | null;
  onSelect: (slug: string) => void;
}) {
  const selectId = useId();
  if (events.length === 0 || !selected) {
    return <span className="font-mono text-xs text-charcoal/60">No event yet</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={selectId} className="font-mono text-[11px] uppercase tracking-wider text-bronze">Event</label>
      <select
        id={selectId}
        value={selected.slug}
        onChange={(e) => onSelect(e.target.value)}
        className="mecha-input w-auto max-w-[16rem] py-1.5 font-mono text-xs"
      >
        {events.map((event) => (
          <option key={event.id} value={event.slug}>
            {event.name} ({event.slug}){event.isTest ? " · TEST" : ""}
          </option>
        ))}
      </select>
      {selected.isTest && (
        <span className="mecha-chip border border-yellow-500/50 bg-yellow-400/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-yellow-800 dark:text-yellow-300">
          TEST
        </span>
      )}
      <span
        className={`mecha-chip border px-2 py-0.5 font-mono text-[11px] font-semibold ${STATUS_TONE_CLASS[statusTone(selected.status)]}`}
        aria-label={`Event status: ${selected.status}`}
      >
        {selected.status === "LIVE" ? "● " : ""}{selected.status}
      </span>
    </div>
  );
}
