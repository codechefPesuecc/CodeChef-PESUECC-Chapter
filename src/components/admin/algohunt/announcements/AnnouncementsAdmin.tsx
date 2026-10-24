"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Send } from "lucide-react";
import { formatIST } from "@/lib/algohunt/format";
import type { AnnouncementPriority, AnnouncementView } from "@/lib/algohunt/types";

export type AdminAnnouncement = AnnouncementView & { active: boolean; createdBy: string };

const MAX_CHARS = 500;
const PRIORITIES: AnnouncementPriority[] = ["INFO", "WARNING", "CRITICAL"];
const TEMPLATES = [
  "The event has started.",
  "The event is temporarily paused.",
  "New QR codes have just been hidden around campus!",
  "The event will resume in 5 minutes.",
  "Final submissions are now closed.",
];

const PRIORITY_CHIP: Record<AnnouncementPriority, string> = {
  INFO: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  WARNING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CRITICAL: "bg-red-500/15 text-red-700 dark:text-red-300",
};

async function send(url: string, method: "POST" | "PATCH", body: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await response.json() as { ok: boolean; error?: string };
    return response.ok && json.ok ? null : json.error ?? "Something went wrong. Please try again.";
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}

export default function AnnouncementsAdmin({
  eventSlug,
  announcements,
  authors,
}: {
  eventSlug: string;
  announcements: AdminAnnouncement[];
  authors: Record<string, string>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("INFO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trimmed = message.trim();
  const tooLong = trimmed.length > MAX_CHARS;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !trimmed || tooLong) return;
    if (priority === "CRITICAL" && !window.confirm("Send this CRITICAL announcement to every team now?")) return;
    setBusy(true);
    setError("");
    const failure = await send(
      `/api/admin/algohunt/announcements?event=${encodeURIComponent(eventSlug)}`, "POST", { message, priority },
    );
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setMessage("");
    setPriority("INFO");
    router.refresh();
  }

  async function deactivate(id: string) {
    setBusy(true);
    setError("");
    const failure = await send(`/api/admin/algohunt/announcements/${encodeURIComponent(id)}`, "PATCH", { active: false });
    setBusy(false);
    if (failure) setError(failure);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="lc-panel space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Compose</h2>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => setMessage(template)}
              className="mecha-btn mecha-btn--ghost mecha-btn--sm normal-case"
            >
              {template}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <label htmlFor="ah-announcement" className="block text-sm font-medium">Message (plain text)</label>
          <textarea
            id="ah-announcement"
            className="mecha-input min-h-28"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_CHARS}
            disabled={busy}
          />
          <p className={`text-right font-mono text-xs ${tooLong ? "text-red-600" : "text-charcoal/60"}`} aria-live="polite">
            {trimmed.length}/{MAX_CHARS}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="ah-priority" className="block text-sm font-medium">Priority</label>
            <select
              id="ah-priority"
              className="mecha-input w-auto"
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              disabled={busy}
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="mecha-btn mecha-btn--solid" disabled={busy || !trimmed || tooLong}>
            <Send aria-hidden className="h-4 w-4" />
            Send
          </button>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-charcoal/60">Preview (as teams see it)</p>
          {priority === "INFO" ? (
            <div className="lc-panel p-4 text-sm">
              <span className={`mecha-chip ${PRIORITY_CHIP.INFO}`}>INFO</span>
              <p className="mt-1 whitespace-pre-line break-words">{trimmed || "Your message"}</p>
            </div>
          ) : (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                priority === "CRITICAL"
                  ? "border-red-500/50 bg-red-500/15 text-red-900 dark:text-red-100"
                  : "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-100"
              }`}
            >
              <Megaphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 whitespace-pre-line break-words">{trimmed || "Your message"}</p>
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>

      <section className="lc-panel p-5" aria-labelledby="ah-announcement-list">
        <h2 id="ah-announcement-list" className="font-display text-lg font-bold">All announcements</h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/60">No announcements yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {announcements.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${a.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-charcoal/60">
                    <span className={`mecha-chip ${PRIORITY_CHIP[a.priority]}`}>{a.priority}</span>
                    <span className={`mecha-chip ${a.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-charcoal/10 text-charcoal/60"}`}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                    <time dateTime={new Date(a.createdAt).toISOString()}>{formatIST(a.createdAt, { withDate: true })}</time>
                    <span>by {authors[a.createdBy] ?? "unknown admin"}</span>
                  </div>
                  <p className="whitespace-pre-line break-words">{a.message}</p>
                </div>
                {a.active && (
                  <button
                    type="button"
                    onClick={() => deactivate(a.id)}
                    disabled={busy}
                    className="mecha-btn mecha-btn--ghost mecha-btn--sm"
                  >
                    Deactivate
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
