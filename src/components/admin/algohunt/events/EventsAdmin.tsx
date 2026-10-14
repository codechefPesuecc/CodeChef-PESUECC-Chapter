"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import AppLink from "@/components/AppLink";
import type { AhEvent } from "@/server/db/schema";
import type { EventStatus } from "@/lib/algohunt/types";

export default function EventsAdmin({ initialEvents, currentSlug }: { initialEvents: AhEvent[]; currentSlug?: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<AhEvent[]>(initialEvents);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auto-slug generator from name
  function handleNameChange(val: string) {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/algohunt/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          isTest,
          maxTeamSize,
        }),
      });

      const json = await res.json() as { ok: boolean; event?: AhEvent; error?: string };
      if (res.ok && json.ok && json.event) {
        setEvents([json.event, ...events]);
        setShowCreate(false);
        setName("");
        setSlug("");
        setMessage({ type: "success", text: `Event "${json.event.name}" created successfully!` });
        router.refresh();
      } else {
        setMessage({ type: "error", text: json.error ?? "Failed to create event." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error creating event." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    if (!confirm("Seed or reset the test event (test-event-2026) with 3 challenges, 5 teams, and code batches?")) {
      return;
    }

    setSeeding(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/algohunt/events/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });

      const json = await res.json() as { ok: boolean; event?: AhEvent; error?: string };
      if (res.ok && json.ok && json.event) {
        setMessage({
          type: "success",
          text: `Test event seeded successfully! Slug: ${json.event.slug}. You can now view and test it.`,
        });
        // Reload list
        const listRes = await fetch("/api/admin/algohunt/events");
        const listJson = await listRes.json() as { ok: boolean; events?: AhEvent[] };
        if (listJson.events) setEvents(listJson.events);
        router.refresh();
      } else {
        setMessage({ type: "error", text: json.error ?? "Failed to seed test event." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error seeding test event." });
    } finally {
      setSeeding(false);
    }
  }

  const statusColors: Record<EventStatus, string> = {
    DRAFT: "bg-neutral-100 text-neutral-700 border-neutral-300",
    CHECK_IN: "bg-blue-50 text-blue-700 border-blue-200",
    READY: "bg-emerald-50 text-emerald-700 border-emerald-200",
    LIVE: "bg-green-100 text-green-800 border-green-300 font-bold animate-pulse",
    PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
    ENDED: "bg-purple-50 text-purple-700 border-purple-200",
    ARCHIVED: "bg-neutral-100 text-neutral-500 border-neutral-200",
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-mono tracking-tight text-ink">
            All AlgoHunt Events ({events.length})
          </h2>
          <p className="text-xs font-mono text-charcoal/60">
            Create, switch between, and seed live and test contest arenas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="mecha-btn inline-flex items-center gap-2 text-xs px-3 py-2 border border-bronze text-bronze hover:bg-bronze/10 disabled:opacity-50"
            title="Sets up test-event-2026 with 3 problems, 5 teams and codes for local/QA testing"
          >
            {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {seeding ? "Seeding..." : "Seed Test Event"}
          </button>

          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="mecha-btn mecha-btn--solid inline-flex items-center gap-2 text-xs px-3 py-2 bg-black text-white hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" />
            {showCreate ? "Cancel" : "New Event"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3 text-xs font-mono rounded-lg border flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Create Event Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="p-5 bg-white border border-hairline rounded-xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold font-mono text-ink">Create New AlgoHunt Event</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-charcoal/80 mb-1">Event Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. AlgoHunt 2.0 Live Arena"
                required
                className="w-full text-xs font-mono px-3 py-2 border border-hairline rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-charcoal/80 mb-1">Slug (URL identifier) *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="e.g. algohunt-2026"
                required
                className="w-full text-xs font-mono px-3 py-2 border border-hairline rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                  className="rounded text-black focus:ring-0"
                />
                <span>Test Event (uses TST- prefix)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-mono text-charcoal/80 mb-1">Max Team Size</label>
              <input
                type="number"
                min={1}
                max={6}
                value={maxTeamSize}
                onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                className="w-24 text-xs font-mono px-3 py-2 border border-hairline rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs font-mono px-3 py-1.5 text-charcoal hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="mecha-btn mecha-btn--solid text-xs px-4 py-1.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      )}

      {/* Events Table */}
      <div className="bg-white border border-hairline rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-sand/60 border-b border-hairline text-charcoal/70">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Event Name</th>
              <th className="py-2.5 px-4 font-semibold">Slug</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Type</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {events.map((ev) => {
              const isSelected = currentSlug === ev.slug;
              const status = ev.status as EventStatus;
              return (
                <tr key={ev.id} className={isSelected ? "bg-amber-50/50" : "hover:bg-sand/20"}>
                  <td className="py-3 px-4 font-bold text-ink">
                    {ev.name}
                    {isSelected && (
                      <span className="ml-2 text-[10px] bg-black text-white px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-charcoal/70">{ev.slug}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-[10px] rounded border ${statusColors[status] ?? ""}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-charcoal/60">
                    {ev.isTest ? (
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                        TEST
                      </span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">
                        LIVE
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <AppLink
                      href={`/admin/algohunt?event=${encodeURIComponent(ev.slug)}`}
                      className="text-xs text-bronze hover:underline"
                    >
                      Overview
                    </AppLink>
                    <span className="text-charcoal/30">·</span>
                    <AppLink
                      href={`/admin/algohunt/control?event=${encodeURIComponent(ev.slug)}`}
                      className="text-xs text-charcoal hover:underline"
                    >
                      Control
                    </AppLink>
                    <span className="text-charcoal/30">·</span>
                    <AppLink
                      href={`/admin/algohunt/import/credentials?event=${encodeURIComponent(ev.slug)}`}
                      className="text-xs text-charcoal hover:underline"
                    >
                      Credentials
                    </AppLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
