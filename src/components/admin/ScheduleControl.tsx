"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pool" | "scheduled" | "live" | "past";

/**
 * Inline scheduler for a pooled/scheduled problem in the admin list. Assigns or
 * clears the Problem-of-the-Day date via /api/admin/problems/[slug]/schedule.
 * Past problems are read-only (already archived).
 */
export default function ScheduleControl({
  slug,
  date,
  status,
  today,
}: {
  slug: string;
  date: string | null;
  status: Status;
  today: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(date ?? today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: { date: string | null }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/problems/${slug}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "past") {
    return <span className="font-mono text-[11px] text-charcoal/40">archived</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          type="date"
          min={today}
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          className="rounded border border-hairline bg-white/70 px-2 py-1 font-mono text-[11px] text-chocolate dark:bg-panel/70"
        />
        <button
          type="button"
          disabled={busy || !value}
          onClick={() => send({ date: value })}
          className="font-mono text-[11px] uppercase tracking-wider text-bronze hover:underline disabled:opacity-50"
        >
          {status === "pool" ? "Schedule" : "Reschedule"}
        </button>
        {status !== "pool" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => send({ date: null })}
            className="font-mono text-[11px] uppercase tracking-wider text-charcoal/50 hover:text-chocolate disabled:opacity-50"
          >
            → Pool
          </button>
        )}
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
