"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Printer, Search, Trash2 } from "lucide-react";
import AppLink from "@/components/AppLink";
import { clearCredentials, loadCredentials, type SavedCredential } from "@/components/admin/algohunt/import/importModel";

interface CredentialTeam {
  id: string;
  teamCode: string;
  teamName: string;
  college: string | null;
  status: string;
  members: { id: string; name: string; isCaptain: boolean }[];
}

interface CredentialsResponse {
  ok: boolean;
  event?: { id: string; slug: string; name: string };
  teams?: CredentialTeam[];
  error?: string;
}

const SLIPS_PER_PAGE = 6;

/**
 * Printable credential slips (M6 brief §7.3). Passwords come only from this browser tab's memory
 * (the Import page puts them there when it creates teams); the server never has them in plain text.
 * A team without one here gets a blank line: reset its password on its team page.
 *
 * There is deliberately no login QR: teams log in on their one laptop, and a QR would invite a
 * phone login, which signs the laptop out.
 */
function CredentialsPrintContent() {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState("AlgoHunt 2.0");
  const [slug, setSlug] = useState(eventSlug);
  const [teams, setTeams] = useState<CredentialTeam[]>([]);
  const [saved, setSaved] = useState<SavedCredential[]>([]);
  const [search, setSearch] = useState("");
  const [onlyWithPassword, setOnlyWithPassword] = useState(true);
  // Slips render only after the client has loaded the teams, so reading window here is safe.
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `/api/admin/algohunt/teams/credentials${eventSlug ? `?event=${encodeURIComponent(eventSlug)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as CredentialsResponse;
        if (cancelled) return;
        if (!res.ok || !json.ok || !json.teams || !json.event) {
          setError(json.error ?? "Failed to load the teams.");
          return;
        }
        setTeams(json.teams);
        setEventName(json.event.name);
        setSlug(json.event.slug);
        const creds = loadCredentials(json.event.slug);
        setSaved(creds);
        if (creds.length === 0) setOnlyWithPassword(false);
      } catch {
        if (!cancelled) setError("Network error loading the teams.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventSlug]);

  const passwords = useMemo(() => new Map(saved.map((c) => [c.teamCode, c.password])), [saved]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) =>
      (!onlyWithPassword || passwords.has(t.teamCode)) &&
      (!q || t.teamCode.toLowerCase().includes(q) || t.teamName.toLowerCase().includes(q) || (t.college ?? "").toLowerCase().includes(q)));
  }, [teams, search, onlyWithPassword, passwords]);
  const pages = useMemo(() => {
    const result: CredentialTeam[][] = [];
    for (let i = 0; i < shown.length; i += SLIPS_PER_PAGE) result.push(shown.slice(i, i + SLIPS_PER_PAGE));
    return result;
  }, [shown]);

  function clear() {
    if (!window.confirm("Forget the passwords held in this tab? Teams you haven't printed will need a password reset.")) return;
    clearCredentials(slug);
    setSaved([]);
    setOnlyWithPassword(false);
  }

  return (
    <div className="algohunt-slips min-h-screen bg-sand p-4 text-ink sm:p-6 print:bg-white print:p-0 print:text-black">
      <div className="mx-auto mb-6 max-w-5xl print:hidden">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
          <div>
            <AppLink
              href={`/admin/algohunt/import?event=${encodeURIComponent(slug)}`}
              className="inline-flex items-center gap-1 font-mono text-xs text-charcoal/70 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Import
            </AppLink>
            <h1 className="mt-1 font-mono text-xl font-bold tracking-tight sm:text-2xl">Team credential slips</h1>
            <p className="font-mono text-xs text-charcoal/70">
              {eventName} · {saved.length} password{saved.length === 1 ? "" : "s"} held in this tab
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || shown.length === 0}
              className="mecha-btn mecha-btn--solid inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Print {shown.length} slips
            </button>
            <button type="button" onClick={clear} disabled={saved.length === 0} className="mecha-btn inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50">
              <Trash2 className="h-4 w-4" /> Clear passwords
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-charcoal/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by team code, name, college"
              className="w-full rounded-lg border border-hairline bg-white py-1.5 pl-9 pr-3 font-mono text-xs"
            />
          </div>
          <label className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" checked={onlyWithPassword} onChange={(e) => setOnlyWithPassword(e.target.checked)} />
            Only teams with a password in this tab
          </label>
          <span className="font-mono text-xs text-charcoal/60">{shown.length} of {teams.length} teams · {pages.length} A4 pages</span>
        </div>
        {saved.length === 0 && !loading && (
          <p className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
            No passwords in this tab. Passwords are shown only when teams are imported (Import → Teams), in the same browser
            tab. For a lost one, use Reset password on the team&apos;s page and write it on the slip.
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 p-16 font-mono text-xs text-charcoal/60 print:hidden">
          <Loader2 className="h-6 w-6 animate-spin" /> Loading teams…
        </div>
      )}
      {error && <div className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 font-mono text-xs text-red-700 print:hidden">{error}</div>}

      {!loading && !error && (
        <div className="space-y-8 print:space-y-0">
          {pages.map((pageTeams, pageIndex) => (
            <div key={pageIndex} className="slip-page mx-auto grid max-w-[210mm] grid-cols-2 gap-3 bg-white p-3 text-black print:max-w-none print:p-0">
              {pageTeams.map((team) => {
                const password = passwords.get(team.teamCode);
                return (
                  <div key={team.id} className="flex min-h-[88mm] flex-col justify-between border-2 border-dashed border-black p-4">
                    <div className="flex items-start justify-between border-b border-black pb-2">
                      <div>
                        <div className="font-mono text-[10px] font-bold tracking-widest">CODECHEF PESU ECC</div>
                        <div className="font-mono text-base font-extrabold">ALGOHUNT 2.0</div>
                      </div>
                      <div className="text-right font-mono text-[10px]">24 Oct 2026<br />Seminar Hall 1</div>
                    </div>
                    <div className="my-3 space-y-2">
                      <div>
                        <div className="font-mono text-[9px] uppercase">Team</div>
                        <div className="text-sm font-bold leading-tight">{team.teamName}</div>
                        {team.college && <div className="text-[10px] leading-tight">{team.college}</div>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="font-mono text-[9px] uppercase">Team code</div>
                          <div className="font-mono text-xl font-black tracking-wider">{team.teamCode}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[9px] uppercase">Password</div>
                          <div className="font-mono text-xl font-black tracking-wider">{password ?? "____________"}</div>
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] uppercase">Log in at</div>
                        <div className="font-mono text-xs font-bold">{origin.replace(/^https?:\/\//, "")}/algohunt/login</div>
                      </div>
                    </div>
                    <ul className="space-y-0.5 border-t border-black pt-2 text-[9.5px] leading-snug">
                      <li>• One laptop per team. Log in only on your team laptop: logging in anywhere else signs it out.</li>
                      <li>• How to play: solve the question → follow your clue book to a QR on campus → enter its code → next question.</li>
                      <li>• Keep this slip secret.</li>
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
          {shown.length === 0 && <p className="p-12 text-center font-mono text-sm text-charcoal/60 print:hidden">No teams to print.</p>}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { background: white !important; }
          .algohunt-slips { padding: 0 !important; }
          .slip-page { break-after: page; page-break-after: always; }
          .slip-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}

export default function CredentialsPrintPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center font-mono text-sm text-charcoal/60">Loading credential slips…</div>}>
      <CredentialsPrintContent />
    </Suspense>
  );
}
