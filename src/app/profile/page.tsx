import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getUserSubmissions, getProfileStats } from "@/server/profile";
import { FLAG_LIMIT, ordinal } from "@/lib/points";
import MechaPanel from "@/components/cp-arena/MechaPanel";

export const metadata: Metadata = {
  title: "Your profile",
};

// Reads the session cookie + DB — never prerender.
export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatClock(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const VERDICT_STYLES: Record<string, string> = {
  AC: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  WA: "bg-red-500/15 text-red-700 dark:text-red-400",
  TLE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  RE: "bg-red-500/15 text-red-700 dark:text-red-400",
  CE: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subs = await getUserSubmissions(user.id);
  const stats = await getProfileStats(user.username, subs.length);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        {/* Identity header */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bronze/15 font-display text-2xl font-bold text-bronze">
            {user.username.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
              @{user.username}
            </h1>
            <p className="mt-1 text-sm text-charcoal/60">
              Member since {formatDay(user.createdAt)}
            </p>
          </div>
          <Link
            href="/cp-arena"
            className="mecha-btn mecha-btn--solid mecha-btn--sm ml-auto"
          >
            Today&apos;s problem →
          </Link>
        </div>

        {/* Private identity (only the owner sees this page) */}
        <MechaPanel className="mt-6" label="Identity">
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 pb-4 pt-3 text-sm">
          <DetailRow label="Email">
            <span className="text-charcoal/80">{user.email}</span>
            {user.emailVerified ? (
              <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                verified
              </span>
            ) : (
              <Link
                href="/verify"
                className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
              >
                verify →
              </Link>
            )}
          </DetailRow>
          <DetailRow label="PRN">
            <span className="font-mono text-charcoal/80">{user.prn}</span>
          </DetailRow>
          <DetailRow label="SRN">
            <span className="font-mono text-charcoal/80">
              {user.srn ?? "—"}
            </span>
          </DetailRow>
          </div>
        </MechaPanel>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="All-time"
            value={stats.allPoints.toLocaleString()}
            sub={stats.allRank ? `${ordinal(stats.allRank)} overall` : "unranked"}
          />
          <StatCard
            label="This month"
            value={stats.monthPoints.toLocaleString()}
            sub={stats.monthRank ? `${ordinal(stats.monthRank)} this month` : "unranked"}
          />
          <StatCard label="Solved" value={String(stats.solved)} sub="problems" />
          <StatCard
            label="Submissions"
            value={String(stats.submissions)}
            sub="recorded"
          />
        </div>

        {/* Submission history */}
        <h2 className="mt-10 font-display text-lg font-bold text-chocolate">
          Submission history
        </h2>
        {subs.length === 0 ? (
          <MechaPanel className="mt-4">
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-charcoal/60">
                No ranked submissions yet.
              </p>
              <Link
                href="/cp-arena"
                className="mt-3 inline-block text-sm font-semibold text-bronze hover:underline"
              >
                Solve today&apos;s Problem of the Day →
              </Link>
            </div>
          </MechaPanel>
        ) : (
          <MechaPanel className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
                  <th className="px-4 py-3 font-medium">Problem</th>
                  <th className="px-4 py-3 font-medium">Verdict</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Lang
                  </th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Time
                  </th>
                  <th className="px-4 py-3 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {subs.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-cream/40 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/cp-arena/archive/${s.slug}`}
                        className="font-medium text-chocolate hover:text-bronze"
                      >
                        {s.title}
                      </Link>
                      {s.flags > 0 && (
                        <span
                          className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            s.flags > FLAG_LIMIT
                              ? "bg-red-500/15 text-red-700 dark:text-red-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {s.flags} flag{s.flags === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          VERDICT_STYLES[s.status] ?? "bg-charcoal/10 text-charcoal/60"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-charcoal/60 sm:table-cell">
                      {s.language}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-charcoal/60 sm:table-cell">
                      {formatClock(s.elapsedSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-charcoal/50">
                      {formatDay(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MechaPanel>
        )}
      </section>
    </main>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-charcoal/40">
        {label}
      </span>
      <span className="flex items-center">{children}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <MechaPanel bodyClassName="px-4 py-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-chocolate">
        {value}
      </div>
      <div className="text-[11px] text-charcoal/50">{sub}</div>
    </MechaPanel>
  );
}
