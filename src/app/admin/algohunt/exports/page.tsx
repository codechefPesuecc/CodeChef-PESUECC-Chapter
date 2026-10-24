import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveAdminEvent } from "@/server/algohunt/events";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Exports · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

const EXPORTS = [
  { type: "results", label: "Results", about: "Final ranking: questions solved, points, finish time, flags. For prizes and certificates." },
  { type: "teams", label: "Teams", about: "Every team with members, emails, phones, status and check-in time." },
  { type: "submissions", label: "Submissions", about: "Every submission's time, team, question, language and verdict (no source code)." },
  { type: "codes", label: "Codes", about: "Every code: batch, status, which team used it and when, placement notes." },
  { type: "code_attempts", label: "Code attempts", about: "Every code a team typed, with the result and IP." },
  { type: "audit", label: "Audit log", about: "Every admin, volunteer and system action." },
] as const;

export default async function AlgoHuntExportsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const { event: slugParam } = await searchParams;
  const event = await resolveAdminEvent(typeof slugParam === "string" ? slugParam : null);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
          Admin console · AlgoHunt 2.0
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Exports
        </h1>
        {event ? (
          <>
            <p className="mt-1 text-sm text-charcoal/60">
              Event: {event.name} <span className="font-mono">({event.slug})</span>. Each button downloads an .xlsx file.
              Downloads are logged.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {EXPORTS.map((item) => (
                <li key={item.type} className="flex flex-col justify-between gap-2 rounded-2xl border border-hairline bg-panel p-4">
                  <div>
                    <h2 className="font-semibold text-chocolate">{item.label}</h2>
                    <p className="text-xs text-charcoal/70">{item.about}</p>
                  </div>
                  <a
                    href={`/api/admin/algohunt/export?event=${encodeURIComponent(event.slug)}&type=${item.type}`}
                    className="mecha-btn mecha-btn--solid self-start px-3 py-1.5 text-xs"
                    download
                  >
                    Download {item.label}.xlsx
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-6 text-sm text-charcoal/70">No AlgoHunt event found. Create an event first.</p>
        )}
      </section>
    </main>
  );
}
