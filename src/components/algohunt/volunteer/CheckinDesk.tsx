"use client";

import { useState, useRef } from "react";
import {
  CheckCircle,
  AlertCircle,
  Search,
  UserCheck,
  Users,
  Building,
  Loader2,
  XCircle,
} from "lucide-react";
import { formatIST } from "@/lib/algohunt/format";
import type { TeamStatus } from "@/lib/algohunt/types";

interface TeamLookupData {
  code: string;
  name: string;
  college: string | null;
  status: TeamStatus;
  checkedInAt: number | null;
  members: string[];
}

export default function CheckinDesk() {
  const [teamCodeQuery, setTeamCodeQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [teamData, setTeamData] = useState<TeamLookupData | null>(null);

  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const query = teamCodeQuery.trim().toUpperCase();
    if (!query) return;

    setLookingUp(true);
    setLookupError(null);
    setCheckinMessage(null);
    setCheckinError(null);
    setTeamData(null);

    try {
      const res = await fetch(`/api/algohunt/volunteer/team?code=${encodeURIComponent(query)}`);
      const json = await res.json() as { ok: boolean; team?: TeamLookupData; error?: string };
      if (!res.ok || !json.ok || !json.team) {
        setLookupError(json.error ?? "Team not found.");
      } else {
        setTeamData(json.team);
      }
    } catch {
      setLookupError("Network error. Please try again.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleCheckin() {
    if (!teamData || checkingIn) return;

    setCheckingIn(true);
    setCheckinMessage(null);
    setCheckinError(null);

    try {
      const res = await fetch("/api/algohunt/volunteer/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamCode: teamData.code }),
      });
      const json = await res.json() as {
        ok: boolean;
        alreadyCheckedIn?: boolean;
        team?: { checkedInAt: number; status: TeamStatus };
        error?: string;
      };

      if (!res.ok || !json.ok || !json.team) {
        setCheckinError(json.error ?? "Failed to check in team.");
      } else {
        const timeStr = formatIST(json.team.checkedInAt);
        if (json.alreadyCheckedIn) {
          setCheckinMessage(`Already checked in at ${timeStr}`);
        } else {
          setCheckinMessage(`✓ Checked in at ${timeStr}`);
        }
        setTeamData((prev) => (prev ? { ...prev, status: json.team!.status, checkedInAt: json.team!.checkedInAt } : null));

        // Re-focus the input for the next team in the queue
        setTimeout(() => {
          inputRef.current?.select();
        }, 100);
      }
    } catch {
      setCheckinError("Network error checking in.");
    } finally {
      setCheckingIn(false);
    }
  }

  function handleReset() {
    setTeamCodeQuery("");
    setTeamData(null);
    setCheckinMessage(null);
    setCheckinError(null);
    setLookupError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      {/* Search Input Box */}
      <form onSubmit={handleFind} className="lc-panel p-5 space-y-3">
        <label htmlFor="team-code-lookup" className="block text-xs font-mono uppercase text-bronze">
          Find Team by Code
        </label>
        <div className="flex gap-2">
          <input
            id="team-code-lookup"
            ref={inputRef}
            type="text"
            className="mecha-input text-base sm:text-lg font-mono uppercase tracking-wider flex-1"
            placeholder="e.g. AH2-T001"
            value={teamCodeQuery}
            onChange={(e) => setTeamCodeQuery(e.target.value.toUpperCase())}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={lookingUp || !teamCodeQuery.trim()}
            className="mecha-btn mecha-btn--solid text-sm px-4 inline-flex items-center gap-1.5"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find
          </button>
        </div>

        {lookupError && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 pt-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {lookupError}
          </p>
        )}
      </form>

      {/* Team Details Card */}
      {teamData && (
        <div className="lc-panel p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-bronze uppercase">Team Details</span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-chocolate mt-0.5">
                {teamData.name}
              </h2>
              <p className="font-mono text-sm text-charcoal/70 tracking-wide mt-0.5">
                {teamData.code}
              </p>
            </div>

            {/* Status Chip */}
            <span
              className={`mecha-chip text-xs font-mono px-3 py-1 rounded-full font-bold uppercase ${
                teamData.status === "CHECKED_IN"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                  : teamData.status === "REGISTERED"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : teamData.status === "FINISHED"
                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                  : "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30"
              }`}
            >
              {teamData.status.replace("_", " ")}
            </span>
          </div>

          {/* College */}
          {teamData.college && (
            <div className="flex items-center gap-2 text-xs text-charcoal/80">
              <Building className="w-4 h-4 text-bronze shrink-0" />
              <span>{teamData.college}</span>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2 border-t border-hairline pt-4">
            <span className="text-xs font-mono uppercase text-charcoal/60 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-bronze" /> Members ({teamData.members.length})
            </span>
            {teamData.members.length === 0 ? (
              <p className="text-xs text-charcoal/50 italic">No members listed</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {teamData.members.map((member, idx) => (
                  <li key={idx} className="flex items-center gap-2 font-medium bg-canvas/40 px-2.5 py-1.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
                    <span>{member}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Checkin Action Feedback */}
          {checkinMessage && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm font-semibold">{checkinMessage}</p>
            </div>
          )}

          {checkinError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-red-800 dark:text-red-200 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm font-semibold">{checkinError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-hairline pt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="mecha-btn mecha-btn--ghost text-xs"
            >
              Scan Another Team
            </button>

            {teamData.status === "REGISTERED" && (
              <button
                type="button"
                onClick={handleCheckin}
                disabled={checkingIn}
                className="mecha-btn mecha-btn--solid text-sm px-6 inline-flex items-center gap-2"
              >
                {checkingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
                Check In Team
              </button>
            )}

            {teamData.status === "CHECKED_IN" && !checkinMessage && (
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                ✓ Checked in at {teamData.checkedInAt ? formatIST(teamData.checkedInAt) : "earlier"}
              </p>
            )}

            {teamData.status === "DISQUALIFIED" && (
              <p className="text-xs font-mono text-red-600 dark:text-red-400 font-bold">
                Team is disqualified. Do not check in.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
