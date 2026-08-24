import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/server/auth/session";
import { getAdminChallengeList, getDailyChallenge } from "@/lib/challenges";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import DeleteProblemButton from "@/components/admin/DeleteProblemButton";

export const metadata: Metadata = { title: "Admin console" };

// Reads the session + DB and gates on admin — must never be prerendered/cached, or
// the static-assets cache interceptor would serve it without running the gate.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const db = getDb();
  const [problems, daily, teacherRows] = await Promise.all([
    getAdminChallengeList(),
    getDailyChallenge(),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isTeacher, true)),
  ]);
  const dailySlug = daily?.slug ?? null;
  const teacherCount = teacherRows.length;

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

        <div className="mt-6 overflow-hidden rounded-2xl border border-hairline bg-white/60 shadow-sm dark:bg-panel/60">
          {problems.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-charcoal/60">
              No problems yet.{" "}
              <Link href="/admin/problems/new" className="font-semibold text-bronze hover:underline">
                Add the first one
              </Link>
              .
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-wider text-charcoal/45">
                  <th className="px-4 py-3 font-medium">Problem</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Difficulty</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {problems.map((p) => (
                  <tr
                    key={p.slug}
                    className="transition-colors hover:bg-cream/40 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-chocolate">{p.title}</div>
                      <div className="font-mono text-[11px] text-charcoal/45">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-charcoal/60">{p.date}</td>
                    <td className="hidden px-4 py-3 text-charcoal/70 sm:table-cell">
                      {p.difficulty}
                    </td>
                    <td className="px-4 py-3">
                      {p.slug === dailySlug ? (
                        <span className="mecha-chip bg-bronze/15 text-bronze">POTD</span>
                      ) : p.released ? (
                        <span className="mecha-chip bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          released
                        </span>
                      ) : (
                        <span className="mecha-chip bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          scheduled
                        </span>
                      )}
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
                          isDaily={p.slug === dailySlug}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
