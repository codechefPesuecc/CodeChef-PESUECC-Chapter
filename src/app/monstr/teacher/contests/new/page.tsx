import { redirect } from "next/navigation";
import { getTeacherUser } from "@/server/auth/session";
import CreateContestForm from "@/components/monstr/CreateContestForm";

export const dynamic = "force-dynamic";

export default async function CreateContestPage() {
  const teacher = await getTeacherUser();
  if (!teacher) redirect("/");

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-bronze">
            New contest
          </p>
          <h1 className="font-display text-3xl font-bold text-chocolate">
            Create a Monstr Contest
          </h1>
          <p className="text-sm text-charcoal/60 mt-2">
            Define problems, select languages, and set a duration.
          </p>
        </div>

        <CreateContestForm />
      </section>
    </main>
  );
}
