import { redirect } from "next/navigation";
import { getTeacherUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests, monstrProblems } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import ContestManager from "@/components/monstr/ContestManager";

export const dynamic = "force-dynamic";

export default async function TeacherContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await getTeacherUser();
  if (!teacher) redirect("/");

  const db = getDb();

  const contestRows = await db
    .select()
    .from(monstrContests)
    .where(eq(monstrContests.id, id))
    .limit(1);

  if (!contestRows[0]) {
    return redirect("/monstr/teacher");
  }

  const contest = contestRows[0];

  // Verify ownership
  if (contest.teacherId !== teacher.id) {
    return redirect("/monstr/teacher");
  }

  const problemRows = await db
    .select({
      id: monstrProblems.id,
      title: monstrProblems.title,
      timeLimit: monstrProblems.timeLimit,
      memoryLimit: monstrProblems.memoryLimit,
    })
    .from(monstrProblems)
    .where(eq(monstrProblems.contestId, contest.id));

  // Ensure joinUrl has proper https scheme for QR code validity
  const host = process.env.NEXT_PUBLIC_APP_URL || "localhost:3000";
  const scheme = host.startsWith("http") ? "" : "https://";
  const joinUrl = `${scheme}${host}/monstr?code=${contest.joinCode}`;

  return (
    <ContestManager
      contestId={contest.id}
      title={contest.title}
      joinCode={contest.joinCode}
      durationMinutes={contest.durationMinutes}
      startedAt={contest.startedAt}
      problems={problemRows}
      joinUrl={joinUrl}
    />
  );
}
