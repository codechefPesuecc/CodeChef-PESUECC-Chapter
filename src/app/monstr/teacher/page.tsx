import Link from "next/link";
import { redirect } from "next/navigation";
import { getTeacherUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const teacher = await getTeacherUser();
  if (!teacher) redirect("/");

  const db = getDb();
  const contests = await db
    .select()
    .from(monstrContests)
    .where(eq(monstrContests.teacherId, teacher.id))
    .orderBy(monstrContests.createdAt);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const getStatus = (contest: typeof contests[0]) => {
    if (!contest.startedAt) return "Not started";
    if (contest.endsAt && contest.endsAt <= now) return "Ended";
    return "Active";
  };

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-bronze">
              Teacher dashboard
            </p>
            <h1 className="font-display text-3xl font-bold text-chocolate">
              Monstr Contests
            </h1>
            <p className="text-sm text-charcoal/60 mt-1">
              {contests.length} contest{contests.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href="/monstr/teacher/contests/new"
            className="mecha-btn mecha-btn--solid ml-auto"
          >
            + New Contest
          </Link>
        </div>

        {contests.length === 0 ? (
          <div className="mecha-wrapper text-center py-12">
            <p className="text-charcoal/60 mb-4">
              No contests yet. Create one to get started.
            </p>
            <Link
              href="/monstr/teacher/contests/new"
              className="mecha-btn text-bronze hover:underline"
            >
              Create your first contest
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map((contest) => (
              <Link
                key={contest.id}
                href={`/monstr/teacher/contests/${contest.id}`}
                className="mecha-wrapper block hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="font-semibold text-chocolate mb-1">
                      {contest.title}
                    </h2>
                    <div className="flex gap-3 text-xs text-charcoal/60">
                      <span>
                        {contest.durationMinutes} min
                      </span>
                      <span>
                        Join code:{" "}
                        <code className="font-mono font-semibold text-charcoal/80">
                          {contest.joinCode}
                        </code>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        getStatus(contest) === "Active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : getStatus(contest) === "Ended"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {getStatus(contest)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
