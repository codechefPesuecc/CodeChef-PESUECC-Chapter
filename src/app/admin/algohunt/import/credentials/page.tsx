"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft, Search, Loader2, KeyRound } from "lucide-react";
import AppLink from "@/components/AppLink";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isCaptain: boolean;
}

interface CredentialTeam {
  id: string;
  teamCode: string;
  teamName: string;
  college: string | null;
  status: string;
  members: TeamMember[];
  plainPassword?: string;
}

interface CredentialsResponse {
  ok: boolean;
  event?: { id: string; slug: string; name: string };
  teams?: CredentialTeam[];
  error?: string;
}

function CredentialsPrintContent() {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>("AlgoHunt 2.0");
  const [teams, setTeams] = useState<CredentialTeam[]>([]);
  const [search, setSearch] = useState("");
  const [passwordOverrides, setPasswordOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const url = `/api/admin/algohunt/teams/credentials${eventSlug ? `?event=${encodeURIComponent(eventSlug)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as CredentialsResponse;
        if (cancelled) return;

        if (!res.ok || !json.ok) {
          setError(json.error ?? "Failed to load team credentials.");
        } else if (json.teams) {
          setTeams(json.teams);
          if (json.event?.name) setEventName(json.event.name);
        }
      } catch {
        if (!cancelled) setError("Network error loading team credentials.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [eventSlug]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter(
      (t) =>
        t.teamCode.toLowerCase().includes(q) ||
        t.teamName.toLowerCase().includes(q) ||
        (t.college && t.college.toLowerCase().includes(q))
    );
  }, [teams, search]);

  // Chunk teams into 4 slips per A4 page (2 columns x 2 rows)
  const pages = useMemo(() => {
    const SLIPS_PER_PAGE = 4;
    const result: CredentialTeam[][] = [];
    for (let i = 0; i < filteredTeams.length; i += SLIPS_PER_PAGE) {
      result.push(filteredTeams.slice(i, i + SLIPS_PER_PAGE));
    }
    return result;
  }, [filteredTeams]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-sand text-ink p-4 sm:p-6 print:p-0 print:bg-white print:text-black">
      {/* Top Toolbar (Hidden on Print) */}
      <div className="mx-auto max-w-5xl mb-6 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AppLink
                href="/admin/algohunt"
                className="text-xs text-charcoal/70 hover:text-ink inline-flex items-center gap-1 font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to AlgoHunt Admin
              </AppLink>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-mono">
              Team Credential Slips
            </h1>
            <p className="text-xs text-charcoal/70 font-mono">
              {eventName} · Printable A4 slips with 1-click login QR codes for check-in desk
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || teams.length === 0}
              className="mecha-btn mecha-btn--solid inline-flex items-center gap-2 text-sm px-4 py-2 bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Print Slips
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-charcoal/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by team code, name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-white border border-hairline rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="text-xs font-mono text-charcoal/60">
            Showing {filteredTeams.length} of {teams.length} teams ({pages.length} A4 pages)
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-charcoal/60 print:hidden font-mono text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-ink" />
          Loading team credentials...
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-xl p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-mono print:hidden">
          {error}
        </div>
      )}

      {/* Printable Pages Container */}
      {!loading && !error && (
        <div className="space-y-8 print:space-y-0">
          {filteredTeams.length === 0 ? (
            <div className="p-12 text-center text-charcoal/60 font-mono text-sm print:hidden">
              No teams found for this event. Import a roster or seed the test event first.
            </div>
          ) : (
            pages.map((pageTeams, pageIndex) => (
              <div
                key={pageIndex}
                className="print-page bg-white text-black p-4 border border-hairline print:border-0 rounded-xl print:rounded-none shadow-sm print:shadow-none mx-auto max-w-[210mm] print:max-w-none print:w-full print:p-0 print:m-0"
                style={{ minHeight: "275mm" }}
              >
                {/* 2 columns x 2 rows grid (4 slips per A4 page) */}
                <div className="grid grid-cols-2 grid-rows-2 gap-4 print:gap-3 h-full">
                  {pageTeams.map((team) => {
                    const password = passwordOverrides[team.id] || team.plainPassword || "";
                    const loginUrl = `${origin}/algohunt/login?teamCode=${encodeURIComponent(
                      team.teamCode
                    )}${password ? `&password=${encodeURIComponent(password)}` : ""}`;

                    return (
                      <div
                        key={team.id}
                        className="border-2 border-dashed border-neutral-400 print:border-black p-4 flex flex-col justify-between rounded-lg print:rounded-none bg-white relative"
                        style={{ minHeight: "130mm" }}
                      >
                        {/* Header Banner */}
                        <div className="border-b border-black pb-2 mb-2 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-mono font-black tracking-widest text-neutral-800 print:text-black">
                              CODECHEF PESU ECC
                            </div>
                            <div className="text-base font-mono font-extrabold tracking-tight">
                              ALGOHUNT 2.0
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-mono font-black bg-black text-white px-2 py-0.5 rounded print:rounded-none inline-block">
                              {team.teamCode}
                            </div>
                          </div>
                        </div>

                        {/* Team Details & QR Code */}
                        <div className="flex gap-4 items-start my-auto">
                          <div className="flex-1 space-y-1.5">
                            <div>
                              <div className="text-[9px] uppercase font-mono text-neutral-500 print:text-neutral-700">
                                Team Name
                              </div>
                              <div className="text-sm font-bold font-mono leading-tight">
                                {team.teamName}
                              </div>
                            </div>

                            {team.college && (
                              <div>
                                <div className="text-[9px] uppercase font-mono text-neutral-500 print:text-neutral-700">
                                  College / Institution
                                </div>
                                <div className="text-xs font-mono leading-tight text-neutral-800">
                                  {team.college}
                                </div>
                              </div>
                            )}

                            {/* Password display / input */}
                            <div className="pt-1">
                              <div className="text-[9px] uppercase font-mono text-neutral-500 print:text-neutral-700 flex items-center gap-1">
                                <KeyRound className="w-2.5 h-2.5" /> Team Password
                              </div>
                              {password ? (
                                <div className="text-sm font-mono font-black tracking-widest bg-neutral-100 print:bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300 inline-block text-black">
                                  {password}
                                </div>
                              ) : (
                                <div className="print:hidden">
                                  <input
                                    type="text"
                                    placeholder="Enter password"
                                    value={passwordOverrides[team.id] || ""}
                                    onChange={(e) =>
                                      setPasswordOverrides({
                                        ...passwordOverrides,
                                        [team.id]: e.target.value,
                                      })
                                    }
                                    className="text-xs font-mono px-2 py-0.5 border border-hairline rounded w-32"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Login QR Code */}
                          <div className="flex flex-col items-center shrink-0">
                            <div className="p-1 border border-neutral-300 rounded bg-white">
                              <QRCodeSVG value={loginUrl} size={110} level="M" marginSize={0} />
                            </div>
                            <span className="text-[8px] font-mono text-neutral-600 mt-0.5">
                              Scan to Log In
                            </span>
                          </div>
                        </div>

                        {/* Team Members */}
                        <div className="border-t border-dashed border-neutral-300 pt-2 mt-2">
                          <div className="text-[8px] uppercase font-mono text-neutral-500 print:text-neutral-700 mb-1">
                            Team Members ({team.members.length})
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono">
                            {team.members.map((m) => (
                              <div key={m.id} className="truncate">
                                • {m.name} {m.isCaptain && <span className="font-bold">(C)</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Slip Footer Instructions */}
                        <div className="border-t border-black pt-1.5 mt-2 flex items-center justify-between text-[8px] font-mono text-neutral-600 print:text-black">
                          <span>arena.codechefpesuecc.org/algohunt</span>
                          <span>Keep this slip safe · Do not share</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Global Print Styles for A4 Output */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-page {
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default function CredentialsPrintPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-charcoal/60 font-mono text-sm">Loading credential slips...</div>}>
      <CredentialsPrintContent />
    </Suspense>
  );
}

