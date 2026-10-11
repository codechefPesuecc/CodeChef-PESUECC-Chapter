import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SubmissionDetailView from "@/components/admin/algohunt/submissions/SubmissionDetailView";
import { getSubmissionDetail } from "@/server/algohunt/adminLogs";
import { getAdminUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Submission Details · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const { id } = await params;
  const submission = await getSubmissionDetail(id);

  if (!submission) {
    notFound();
  }

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
          Admin console · AlgoHunt 2.0
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Submission Code Inspection
        </h1>
        <div className="mt-6">
          <SubmissionDetailView submission={submission} />
        </div>
      </section>
    </main>
  );
}
