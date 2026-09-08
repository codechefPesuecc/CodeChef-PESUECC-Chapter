"use client";

import { useState } from "react";

export interface RecruitmentPanelState {
  isOpen: boolean;
  formUrl: string | null;
  cycle: string | null;
  closesOn: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

export default function RecruitmentPanel({ initial }: { initial: RecruitmentPanelState }) {
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [formUrl, setFormUrl] = useState(initial.formUrl ?? "");
  const [cycle, setCycle] = useState(initial.cycle ?? "");
  const [closesOn, setClosesOn] = useState(initial.closesOn ?? "");
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    isOpen !== saved.isOpen ||
    formUrl !== (saved.formUrl ?? "") ||
    cycle !== (saved.cycle ?? "") ||
    closesOn !== (saved.closesOn ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Only the fields the admin actually touched — the server does a partial
      // merge, so sending untouched fields too would silently overwrite
      // whatever another admin (or this same admin, another tab) saved to them
      // since this panel loaded.
      const patch: Record<string, unknown> = {};
      if (isOpen !== saved.isOpen) patch.isOpen = isOpen;
      if (formUrl !== (saved.formUrl ?? "")) patch.formUrl = formUrl;
      if (cycle !== (saved.cycle ?? "")) patch.cycle = cycle;
      if (closesOn !== (saved.closesOn ?? "")) patch.closesOn = closesOn;

      const res = await fetch("/api/admin/recruitment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      // Sync to what the server actually persisted, not a client-side guess —
      // covers server-side URL normalization and gives updatedAt/updatedBy
      // real values instead of a fabricated timestamp and a stale admin id.
      const s = data.settings as RecruitmentPanelState;
      setSaved(s);
      setIsOpen(s.isOpen);
      setFormUrl(s.formUrl ?? "");
      setCycle(s.cycle ?? "");
      setClosesOn(s.closesOn ?? "");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={save}
        className="rounded-2xl border border-hairline bg-white/60 p-5 shadow-sm dark:bg-panel/60"
      >
        <label className="flex items-center gap-2 text-sm text-charcoal/80">
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
          />
          Recruitment is open — /join renders the form
        </label>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs text-charcoal/60 sm:col-span-2">
            Google Form URL
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/d/e/…/viewform"
              className="mecha-input mt-1"
            />
          </label>
          <label className="text-xs text-charcoal/60">
            Cycle label
            <input
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              placeholder="2026-27"
              className="mecha-input mt-1"
            />
          </label>
          <label className="text-xs text-charcoal/60">
            Closes on
            <input
              type="date"
              value={closesOn}
              onChange={(e) => setClosesOn(e.target.value)}
              className="mecha-input mt-1"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button type="submit" disabled={saving || !dirty} className="mecha-btn mecha-btn--solid">
            {saving ? "Saving…" : "Save"}
          </button>
          {!dirty && !error && (
            <span className="text-xs text-charcoal/45">
              {saved.updatedAt ? "Saved." : "Nothing saved yet."}
            </span>
          )}
        </div>

        <p className="mt-4 text-[11px] text-charcoal/45">
          Paste either the plain form link or the one from the embed (&lt;&gt;) dialog — both
          work. Must be an https://docs.google.com/forms/… URL.
        </p>
      </form>
    </div>
  );
}
