"use client";

import { useEffect } from "react";
import { Megaphone } from "lucide-react";
import type { AnnouncementPriority, AnnouncementView } from "@/lib/algohunt/types";
import { formatIST } from "@/lib/algohunt/format";
import { addStoredIds, useStoredIds } from "./storedIds";

const SEEN_KEY = "ah:seen-announcements";
const SEEN_AFTER_MS = 8000;

const PRIORITY_CHIP: Record<AnnouncementPriority, string> = {
  INFO: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  WARNING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CRITICAL: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/** Latest active announcements. Ids not seen on this device before get a "New" badge for a few seconds. */
export default function AnnouncementsCard({ announcements }: { announcements: AnnouncementView[] }) {
  const seen = useStoredIds(SEEN_KEY);
  const unseen = announcements.filter((a) => !seen.has(a.id)).map((a) => a.id);
  const unseenKey = unseen.join(",");

  useEffect(() => {
    if (!unseenKey) return;
    const id = setTimeout(() => addStoredIds(SEEN_KEY, unseenKey.split(",")), SEEN_AFTER_MS);
    return () => clearTimeout(id);
  }, [unseenKey]);

  return (
    <section className="lc-panel p-4" aria-labelledby="ah-announcements">
      <h2 id="ah-announcements" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-charcoal/60">
        <Megaphone aria-hidden className="h-3.5 w-3.5" />
        Announcements
        {unseen.length > 0 && <span className="mecha-chip bg-bronze/20 text-bronze">New</span>}
      </h2>
      {announcements.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal/60">No announcements yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-charcoal/60">
                <span className={`mecha-chip ${PRIORITY_CHIP[a.priority]}`}>{a.priority}</span>
                <time dateTime={new Date(a.createdAt).toISOString()}>{formatIST(a.createdAt)}</time>
              </div>
              <p className="whitespace-pre-line break-words">{a.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
