"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import AppLink from "@/components/AppLink";
import type { AhEvent } from "@/server/db/schema";
import type { EventStatus } from "@/lib/algohunt/types";
import ConfirmAction from "@/components/admin/algohunt/ConfirmAction";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";

interface SeededTeam {
  teamName: string;
  teamCode: string;
  password: string;
}

const SEED_SLUG = "test-event-2026";

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
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [seeded, setSeeded] = useState<{ slug: string; teams: SeededTeam[]; codes: { serial: number; code: string }[] } | null>(null);
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

  async function handleSeed({ confirm }: { confirm: string }) {
    setSeeding(true);
    setMessage(null);
    try {
      const json = await adminFetch<{ event: AhEvent; teams: SeededTeam[]; codes: { serial: number; code: string }[] }>(
        "POST", "/api/admin/algohunt/events/seed", { reset: true, confirm },
      );
      setSeedConfirmOpen(false);
      setSeeded({ slug: json.event.slug, teams: json.teams, codes: json.codes });
      setMessage({ type: "success", text: `Test event ${json.event.slug} seeded. Its logins and codes are below, shown once.` });
      const listRes = await fetch("/api/admin/algohunt/events");
      const listJson = await listRes.json() as { ok: boolean; events?: AhEvent[] };
      if (listJson.events) setEvents(listJson.events);
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  function downloadSeedJson() {
    if (!seeded) return;
    // The load-test creds format (M2): { eventSlug, teams: [{ teamName, teamCode, password }] }.
    const blob = new Blob([JSON.stringify({ eventSlug: seeded.slug, teams: seeded.teams }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${seeded.slug}-creds.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const statusColors: Record<EventStatus, string> = {
    DRAFT: "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-500/15 dark:text-neutral-300 dark:border-neutral-500/30",
    CHECK_IN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    READY: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    LIVE: "bg-green-100 text-green-800 border-green-300 font-bold animate-pulse dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
    PAUSED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    ENDED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
    ARCHIVED: "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-500/15 dark:text-neutral-400 dark:border-neutral-500/30",
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
            onClick={() => setSeedConfirmOpen(true)}
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
        <form onSubmit={handleCreate} className="p-5 bg-panel border border-hairline rounded-xl shadow-sm space-y-4">
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
      <div className="bg-panel border border-hairline rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-mono text-charcoal">
          <thead className="bg-bronze/5 border-b border-hairline text-charcoal/70">
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
                <tr key={ev.id} className={isSelected ? "bg-amber-50/50 dark:bg-amber-500/10" : "hover:bg-hairline/20"}>
                  <td className="py-3 px-4 font-bold text-chocolate">
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
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30">
                        TEST
                      </span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30">
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
                      href={`/admin/algohunt/import?event=${encodeURIComponent(ev.slug)}`}
                      className="text-xs text-charcoal hover:underline"
                    >
                      Import
                    </AppLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {seeded && (
        <section aria-label="Seeded test logins" className="rounded-xl border border-yellow-500/50 bg-yellow-400/10 p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-chocolate">
              {seeded.slug}: test logins and codes (shown once)
            </h3>
            <button type="button" onClick={downloadSeedJson} className="mecha-btn px-3 py-1 text-xs">
              Download creds JSON
            </button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <table className="w-full font-mono text-xs">
              <thead><tr className="text-left text-charcoal/60"><th>Team</th><th>Code</th><th>Password</th></tr></thead>
              <tbody>
                {seeded.teams.map((team) => (
                  <tr key={team.teamCode}><td className="pr-2">{team.teamName}</td><td className="pr-2">{team.teamCode}</td><td>{team.password}</td></tr>
                ))}
              </tbody>
            </table>
            <ul className="grid grid-cols-3 gap-1 font-mono text-xs">
              {seeded.codes.map((code) => (
                <li key={code.serial}>#{String(code.serial).padStart(3, "0")} {code.code}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <ConfirmAction
        open={seedConfirmOpen}
        title="Seed the test event"
        consequences={`Wipes ${SEED_SLUG} (a test event) and re-creates it with 3 test questions, 5 checked-in teams and 15 codes. Real events are never touched.`}
        confirmPhrase={SEED_SLUG}
        confirmLabel={seeding ? "Seeding…" : "Seed test event"}
        danger
        onConfirm={handleSeed}
        onClose={() => setSeedConfirmOpen(false)}
      />
    </div>
  );
}
