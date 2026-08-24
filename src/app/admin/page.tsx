import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/server/auth/session";
import { getAdminChallengeList, todayStr, type AdminChallengeItem } from "@/lib/challenges";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import DeleteProblemButton from "@/components/admin/DeleteProblemButton";
import ScheduleControl from "@/components/admin/ScheduleControl";

export const metadata: Metadata = { title: "Admin console" };

// Reads the session + DB and gates on admin — must never be prerendered/cached, or
// the static-assets cache interceptor would serve it without running the gate.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const db = getDb();
  const [problems, teacherRows] = await Promise.all([
    getAdminChallengeList(),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isTeacher, true)),
  ]);
  const teacherCount = teacherRows.length;
  const today = todayStr();

  const pool = problems.filter((p) => p.status === "pool");
  const live = problems.filter((p) => p.status === "live");
  // Upcoming: soonest first.
  const upcoming = problems
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const past = problems.filter((p) => p.status === "past");

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <nav className="flex gap-4">
            <Link
              href="/admin"
              className="font-mono text-xs uppercase tracking-wider font-medium text-chocolate hover:text-bronze transition"
            >
              CP Arena
            </Link>
            <Link
              href="/admin/teachers"
              className="font-mono text-xs uppercase tracking-wider font-medium text-charcoal/60 hover:text-chocolate transition"
            >
              Teachers
            </Link>
            <Link
              href="/admin/users"
              className="font-mono text-xs uppercase tracking-wider font-medium text-charcoal/60 hover:text-chocolate transition"
            >
              Users
            </Link>
          </nav>
        </div>

        {/* Teacher Management Card */}
        <div className="mb-8 p-6 rounded-2xl border border-hairline bg-blue-50/40 dark:bg-blue-900/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                Monstr Teacher Management
              </p>
              <p className="text-3xl font-bold text-chocolate mt-2">
                {teacherCount}
              </p>
              <p className="text-xs text-charcoal/60 mt-1">
                {teacherCount === 1 ? "teacher" : "teachers"} available
              </p>
            </div>
            <Link
              href="/admin/teachers"
              className="mecha-btn mecha-btn--solid"
            >
              Manage Teachers
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
              Admin console
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
              CP Arena problems
            </h1>
            <p className="mt-1 text-sm text-charcoal/60">
              {problems.length} problem{problems.length === 1 ? "" : "s"} · signed in as @{admin.username}
            </p>
          </div>
          <Link
            href="/admin/problems/new"
            className="mecha-btn mecha-btn--solid ml-auto"
          >
            + New problem
          </Link>
        </div>

        {problems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-hairline bg-white/60 px-6 py-12 text-center text-sm text-charcoal/60 dark:bg-panel/60">
            No problems yet.{" "}
            <Link href="/admin/problems/new" className="font-semibold text-bronze hover:underline">
              Add the first one
            </Link>
            .
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            <ProblemGroup
              title="Live today"
              hint="The Problem of the Day — visible and ranked right now. Expires at IST midnight."
              items={live}
              today={today}
              empty="No problem is live today. Schedule one from the pool."
            />
            <ProblemGroup
              title={`Question pool · ${pool.length}`}
              hint="Unscheduled problems. Pick a date to promote one to Problem of the Day."
              items={pool}
              today={today}
              empty="Pool is empty — new problems land here."
            />
            <ProblemGroup
              title="Upcoming"
              hint="Scheduled for a future day; hidden from users until then."
              items={upcoming}
              today={today}
              empty="Nothing scheduled ahead — tomorrow has no Problem of the Day yet."
            />
            <ProblemGroup
              title="Past · practice archive"
              hint="Already been live; solvable as unranked practice, kept for history."
              items={past}
              today={today}
              empty="No past problems yet."
            />
          </div>
        )}
      </section>
    </main>
  );
}

function ProblemGroup({
  title,
  hint,
  items,
  today,
  empty,
}: {
  title: string;
  hint: string;
  items: AdminChallengeItem[];
  today: string;
  empty: string;
}) {
  return (
    <div>
      <h2 className="font-display text-base font-bold text-chocolate">{title}</h2>
      <p className="text-xs text-charcoal/55">{hint}</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-hairline bg-white/60 shadow-sm dark:bg-panel/60">
        {items.length === 0 ? (
          <div className="px-6 py-6 text-center text-xs text-charcoal/50">{empty}</div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-hairline">
              {items.map((p) => (
                <tr
                  key={p.slug}
                  className="transition-colors hover:bg-cream/40 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-chocolate">{p.title}</div>
                    <div className="font-mono text-[11px] text-charcoal/45">
                      {p.slug} · {p.difficulty}
                      {p.date ? ` · ${p.date}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ScheduleControl
                      slug={p.slug}
                      date={p.date}
                      status={p.status}
                      today={today}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/problems/${p.slug}/edit`}
                        className="font-mono text-[11px] uppercase tracking-wider text-bronze hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteProblemButton
                        slug={p.slug}
                        title={p.title}
                        isDaily={p.status === "live"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
