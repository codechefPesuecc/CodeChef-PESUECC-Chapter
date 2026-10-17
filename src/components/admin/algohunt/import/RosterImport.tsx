"use client";

import { useMemo, useState } from "react";
import Link from "@/components/AppLink";
import { adminFetch } from "@/components/admin/algohunt/control/adminFetch";
import {
  credentialRows, guessMapping, mapRoster, rowIndexOf, saveCredentials,
  type RosterMapping, type SavedCredential,
} from "./importModel";

const CHUNK = 10;

type Sheet = { fileName: string; headers: string[]; rows: Record<string, unknown>[] };

function ColumnSelect({ label, value, headers, onChange }: {
  label: string; value: string | null; headers: string[]; onChange: (v: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-charcoal/70">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded border border-hairline bg-panel px-1 py-1 font-mono text-xs"
      >
        <option value="">(none)</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );
}

/**
 * Teams tab: upload the registration sheet (CSV/XLSX), map its columns, check it, then create the
 * teams in chunks of 10. Each team's password is shown once: it goes to this tab's memory and to
 * the credential slips page, and is never stored on the server.
 */
export default function RosterImport({ eventSlug, maxTeamSize, editable, onImported }: {
  eventSlug: string;
  maxTeamSize: number;
  editable: boolean;
  onImported: () => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<RosterMapping | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [check, setCheck] = useState<{
    errors: string[]; warnings: string[]; byRow: Map<number, string[]>; errorRows: Set<number>;
  } | null>(null);
  const [markCheckedIn, setMarkCheckedIn] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [created, setCreated] = useState<SavedCredential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const url = (dry: boolean) => `/api/admin/algohunt/import/teams?event=${encodeURIComponent(eventSlug)}${dry ? "&dryRun=1" : ""}`;

  const mapped = useMemo(() => (sheet && mapping ? mapRoster(sheet.rows, mapping) : []), [sheet, mapping]);
  const included = mapped.filter((_, i) => !excluded.has(i));

  async function readFile(file: File) {
    setError(null);
    setCheck(null);
    setCreated([]);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const first = workbook.Sheets[workbook.SheetNames[0]];
      if (!first) throw new Error("The file has no sheet.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(first, { defval: "", raw: false });
      const headers = (XLSX.utils.sheet_to_json<string[]>(first, { header: 1 })[0] ?? []).map(String).filter(Boolean);
      setSheet({ fileName: file.name, headers, rows });
      setMapping(guessMapping(headers, maxTeamSize));
      setExcluded(new Set());
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}`);
    }
  }

  function setMember(slot: number, field: "name" | "email" | "phone", value: string | null) {
    setMapping((m) => m && { ...m, members: m.members.map((s, i) => (i === slot ? { ...s, [field]: value } : s)) });
    setCheck(null);
  }

  async function runCheck() {
    setError(null);
    try {
      const res = await adminFetch<{ errors: string[]; warnings: string[] }>("POST", url(true), { teams: included.map((r) => r.team) });
      // Map "Row N" back to the preview's rows (only included rows were sent).
      const includedIndexes = mapped.map((_, i) => i).filter((i) => !excluded.has(i));
      const byRow = new Map<number, string[]>();
      const errorRows = new Set<number>();
      for (const [message, isError] of [...res.errors.map((m) => [m, true] as const), ...res.warnings.map((m) => [m, false] as const)]) {
        const sent = rowIndexOf(message);
        if (sent === null) continue;
        const original = includedIndexes[sent];
        if (isError) errorRows.add(original);
        byRow.set(original, [...(byRow.get(original) ?? []), message.replace(/^Row \d+( \([^)]*\))?: /, "")]);
      }
      setCheck({ errors: res.errors, warnings: res.warnings, byRow, errorRows });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runImport() {
    setError(null);
    const teams = included.map((r) => r.team);
    const all: SavedCredential[] = [];
    setProgress({ done: 0, total: teams.length });
    try {
      for (let i = 0; i < teams.length; i += CHUNK) {
        const res = await adminFetch<{ created: SavedCredential[] }>("POST", url(false), { teams: teams.slice(i, i + CHUNK), markCheckedIn });
        all.push(...res.created);
        saveCredentials(eventSlug, res.created);
        setCreated([...all]);
        setProgress({ done: Math.min(teams.length, i + CHUNK), total: teams.length });
      }
      setSheet(null);
      setMapping(null);
      setCheck(null);
    } catch (e) {
      setError(`${(e as Error).message} ${all.length > 0 ? `The first ${all.length} teams were created; their passwords are below. Remove them from the sheet before importing the rest.` : ""}`);
    } finally {
      setProgress(null);
      onImported();
    }
  }

  async function downloadXlsx() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(credentialRows(created, window.location.origin));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "credentials");
    XLSX.writeFile(wb, `algohunt-credentials-${eventSlug}.xlsx`);
  }

  return (
    <div className="space-y-4">
      {!editable && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          The event has ended, so no more teams can be added.
        </p>
      )}

      {created.length > 0 && (
        <section className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm">
          <p className="font-semibold text-chocolate">
            {created.length} team{created.length === 1 ? "" : "s"} created. Passwords are shown only now: print the slips or download them.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/admin/algohunt/import/credentials?event=${encodeURIComponent(eventSlug)}`} className="mecha-btn mecha-btn--solid px-3 py-1.5 text-xs">
              Print credential slips
            </Link>
            <button type="button" className="mecha-btn px-3 py-1.5 text-xs" onClick={() => void downloadXlsx()}>Download XLSX</button>
          </div>
          <table className="mt-3 w-full font-mono text-xs">
            <tbody>
              {created.map((c) => (
                <tr key={c.teamCode}><td className="pr-3">{c.teamCode}</td><td className="pr-3">{c.teamName}</td><td>{c.password}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {editable && (
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-hairline bg-panel px-4 py-6 text-center text-sm">
          <span className="font-semibold text-chocolate">{sheet ? `Loaded ${sheet.fileName} (${sheet.rows.length} rows)` : "Choose the registration sheet (.xlsx or .csv)"}</span>
          <span className="text-xs text-charcoal/60">Export the Google Form responses. Only paid, confirmed teams should be in it: untick any others below.</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
        </label>
      )}

      {sheet && mapping && (
        <>
          <section className="rounded-xl border border-hairline bg-panel p-4">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-bronze">Columns</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <ColumnSelect label="Team name" value={mapping.teamName} headers={sheet.headers} onChange={(v) => { setMapping({ ...mapping, teamName: v }); setCheck(null); }} />
              <ColumnSelect label="College" value={mapping.college} headers={sheet.headers} onChange={(v) => { setMapping({ ...mapping, college: v }); setCheck(null); }} />
            </div>
            <div className="mt-3 space-y-2">
              {mapping.members.map((slot, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-3">
                  <ColumnSelect label={`Member ${i + 1}${i === 0 ? " (captain)" : ""} name`} value={slot.name} headers={sheet.headers} onChange={(v) => setMember(i, "name", v)} />
                  <ColumnSelect label="Email" value={slot.email} headers={sheet.headers} onChange={(v) => setMember(i, "email", v)} />
                  <ColumnSelect label="Phone" value={slot.phone} headers={sheet.headers} onChange={(v) => setMember(i, "phone", v)} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm text-charcoal/70">{included.length} of {mapped.length} teams selected.</p>
            <div className="mt-2 max-h-[28rem] overflow-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr className="text-charcoal/60"><th className="p-2"></th><th className="p-2">Sheet row</th><th className="p-2">Team</th><th className="p-2">College</th><th className="p-2">Members</th><th className="p-2">Check</th></tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {mapped.map(({ team, sourceRow }, i) => {
                    const notes = check?.byRow.get(i) ?? [];
                    const bad = check?.errorRows.has(i) ?? false;
                    return (
                      <tr key={i} className={excluded.has(i) ? "opacity-50" : ""}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            aria-label={`Include ${team.teamName}`}
                            checked={!excluded.has(i)}
                            onChange={(e) => {
                              setExcluded((prev) => { const next = new Set(prev); if (e.target.checked) next.delete(i); else next.add(i); return next; });
                              setCheck(null);
                            }}
                          />
                        </td>
                        <td className="p-2 font-mono">{sourceRow}</td>
                        <td className="p-2 font-medium">{team.teamName}</td>
                        <td className="p-2">{team.college ?? ""}</td>
                        <td className="p-2">{team.members.map((m) => m.name).join(", ")} ({team.members.length})</td>
                        <td className={`p-2 ${bad ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"}`}>{notes.join(" · ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {check && (
            <p className={`text-sm ${check.errors.length > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {check.errors.length > 0
                ? `${check.errors.length} error${check.errors.length === 1 ? "" : "s"}: fix the sheet or untick those rows, then check again.`
                : `✓ Ready to import ${included.length} teams${check.warnings.length > 0 ? ` (${check.warnings.length} warnings)` : ""}.`}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="mecha-btn px-4 py-2 text-sm" disabled={included.length === 0} onClick={() => void runCheck()}>
              Check roster
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={markCheckedIn} onChange={(e) => setMarkCheckedIn(e.target.checked)} />
              Mark as checked in
            </label>
            <button
              type="button"
              className="mecha-btn mecha-btn--solid px-4 py-2 text-sm"
              disabled={!check || check.errors.length > 0 || progress !== null || included.length === 0}
              onClick={() => void runImport()}
            >
              {progress ? `Importing ${progress.done}/${progress.total}…` : `Import ${included.length} teams`}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
