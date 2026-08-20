import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { monstrContests, monstrProblems, monstrParticipants } from "@/server/db/schema";
import MonstrWorkspace from "@/components/monstr/MonstrWorkspace";

export const dynamic = "force-dynamic";

export default async function StudentContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();

  // Verify participant
  const participantRows = await db
    .select()
    .from(monstrParticipants)
    .where(
      and(
        eq(monstrParticipants.contestId, id),
        eq(monstrParticipants.userId, user.id),
      ),
    )
    .limit(1);

  if (!participantRows[0]) {
    redirect("/monstr");
  }

  // Get contest
  const contestRows = await db
    .select()
    .from(monstrContests)
    .where(eq(monstrContests.id, id))
    .limit(1);

  if (!contestRows[0]) {
    redirect("/monstr");
  }

  const contest = contestRows[0];

  // Prevent students from reading problem statements before contest starts
  if (!contest.startedAt) {
    redirect("/monstr");
  }

  // Get problems (public fields only), sorted by order
  const problems = await db
    .select({
      id: monstrProblems.id,
      title: monstrProblems.title,
      orderIndex: monstrProblems.orderIndex,
    })
    .from(monstrProblems)
    .where(eq(monstrProblems.contestId, id))
    .orderBy(monstrProblems.orderIndex);

  // Get first problem public details ONLY (never tests or checker)
  const firstProblem = problems[0];
  if (!firstProblem) redirect("/monstr");

  const firstProblemDetail = await db
    .select({
      id: monstrProblems.id,
      title: monstrProblems.title,
      statement: monstrProblems.statement,
      inputFormat: monstrProblems.inputFormat,
      outputFormat: monstrProblems.outputFormat,
      constraints: monstrProblems.constraints,
      samples: monstrProblems.samples,
      contentHtml: monstrProblems.contentHtml,
      timeLimit: monstrProblems.timeLimit,
      memoryLimit: monstrProblems.memoryLimit,
    })
    .from(monstrProblems)
    .where(eq(monstrProblems.id, firstProblem.id))
    .limit(1);

  if (!firstProblemDetail[0]) redirect("/monstr");

  let allowedLanguages: Array<string> = [];
  try {
    allowedLanguages = JSON.parse(contest.allowedLanguages) as Array<string>;
  } catch (e) {
    console.error("[StudentContestPage] Failed to parse allowedLanguages:", e);
    redirect("/monstr");
  }

  let samples: any[] = [];
  try {
    samples = JSON.parse(firstProblemDetail[0].samples || "[]");
  } catch (e) {
    console.error("[StudentContestPage] Failed to parse samples:", e);
    redirect("/monstr");
  }

  const now = Date.now();

  const firstProblemWithParsedSamples = {
    ...firstProblemDetail[0],
    samples,
  };

  return (
    <MonstrWorkspace
      contestId={id}
      startedAt={contest.startedAt}
      endsAt={contest.endsAt}
      serverNow={now}
      problems={problems}
      allowedLanguages={allowedLanguages}
      initialProblem={firstProblemWithParsedSamples}
    />
  );
}
