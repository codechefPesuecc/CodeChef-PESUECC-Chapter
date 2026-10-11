"use client";

import { useState } from "react";
import { UserPlus, Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { usePoll } from "@/components/algohunt/usePoll";

export interface VolunteerItem {
  id: string;
  userId: string;
  username: string;
  name: string | null;
  active: boolean;
}

interface VolunteersResponse {
  ok: boolean;
  volunteers: VolunteerItem[];
}

export default function VolunteersAdmin({ eventSlug }: { eventSlug: string }) {
  const [usernameInput, setUsernameInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const url = `/api/admin/algohunt/volunteers?event=${encodeURIComponent(eventSlug)}`;
  const { data, loading, error: pollError, refresh } = usePoll<VolunteersResponse>(url, {
    intervalMs: 15000,
  });

  const volunteers = data?.volunteers ?? [];

  async function handleAddVolunteer(e: React.FormEvent) {
    e.preventDefault();
    const username = usernameInput.trim();
    if (!username || adding) return;

    setAdding(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const json = await res.json() as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !json.ok) {
        setAddError(json.error ?? "Failed to assign volunteer.");
      } else {
        setAddSuccess(`Volunteer @${username} assigned successfully.`);
        setUsernameInput("");
        refresh();
      }
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(vol: VolunteerItem) {
    if (!window.confirm(`Remove volunteer access for @${vol.username}?`)) {
      return;
    }

    setRemovingId(vol.id);
    try {
      const res = await fetch(`/api/admin/algohunt/volunteers/${encodeURIComponent(vol.id)}`, {
        method: "DELETE",
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (res.ok && json.ok) {
        refresh();
      } else {
        alert(json.error ?? "Failed to remove volunteer.");
      }
    } catch {
      alert("Network error removing volunteer.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Volunteer Form */}
      <form onSubmit={handleAddVolunteer} className="lc-panel p-5 space-y-4">
        <h2 className="font-display text-lg font-bold text-chocolate flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-bronze" /> Assign Volunteer
        </h2>
        <p className="text-xs text-charcoal/60">
          Enter an existing platform username to grant check-in desk access for this event.
        </p>

        {addSuccess && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{addSuccess}</span>
          </div>
        )}

        {addError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{addError}</span>
          </div>
        )}

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            className="mecha-input text-xs font-mono"
            placeholder="Username (e.g. john_doe)"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            disabled={adding}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button
            type="submit"
            disabled={adding || !usernameInput.trim()}
            className="mecha-btn mecha-btn--solid text-xs px-4 shrink-0 inline-flex items-center gap-1.5"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Assign
          </button>
        </div>
      </form>

      {/* Volunteers Table */}
      <div className="lc-panel p-5 space-y-3">
        <h2 className="font-display text-lg font-bold text-chocolate">Assigned Volunteers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline font-mono uppercase text-[11px] text-charcoal/50">
                <th className="pb-2">Username</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {volunteers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center font-mono text-charcoal/60">
                    {loading ? "Loading volunteers..." : pollError ?? "No volunteers assigned yet."}
                  </td>
                </tr>
              ) : (
                volunteers.map((vol) => (
                  <tr key={vol.id} className="hover:bg-hairline/20">
                    <td className="py-2.5 font-mono font-medium text-chocolate">@{vol.username}</td>
                    <td className="py-2.5 text-charcoal/80">{vol.name || "—"}</td>
                    <td className="py-2.5">
                      <span
                        className={`mecha-chip text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          vol.active
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                            : "bg-red-500/15 text-red-700 dark:text-red-300 line-through"
                        }`}
                      >
                        {vol.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {vol.active && (
                        <button
                          type="button"
                          onClick={() => handleRemove(vol)}
                          disabled={removingId === vol.id}
                          className="mecha-btn mecha-btn--ghost text-[11px] text-red-600 hover:text-red-700 px-2 py-1 inline-flex items-center gap-1"
                        >
                          {removingId === vol.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
