"use client";

import { Megaphone, X } from "lucide-react";
import { useParticipantState } from "./ParticipantStateProvider";
import { addStoredIds, useStoredIds } from "./storedIds";

export const DISMISSED_KEY = "ah:dismissed";

/** The newest active WARNING/CRITICAL announcement, dismissible per device. */
export default function AnnouncementStrip() {
  const { state } = useParticipantState();
  const dismissed = useStoredIds(DISMISSED_KEY);
  const announcement = state.announcements.find(
    (a) => (a.priority === "WARNING" || a.priority === "CRITICAL") && !dismissed.has(a.id),
  );
  if (!announcement) return null;
  const critical = announcement.priority === "CRITICAL";

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        critical
          ? "border-red-500/50 bg-red-500/15 text-red-900 dark:text-red-100"
          : "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-100"
      }`}
    >
      <Megaphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      {/* Plain text only: React escapes it. */}
      <p className="flex-1 whitespace-pre-line break-words">{announcement.message}</p>
      <button
        type="button"
        onClick={() => addStoredIds(DISMISSED_KEY, [announcement.id])}
        className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
        aria-label="Dismiss announcement"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
