import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/session";
import { getChallengeForAdmin } from "@/lib/challenges";
import ProblemForm from "@/components/admin/ProblemForm";

export const metadata: Metadata = { title: "Edit problem" };
export const dynamic = "force-dynamic";

export default async function EditProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Gate BEFORE fetching — the full record carries hidden tests/checker, which must
  // only ever reach an admin's browser.
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const { slug } = await params;
  const challenge = await getChallengeForAdmin(slug);
  if (!challenge) notFound();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-6 pb-24">
        <Link
          href="/admin"
          className="font-mono text-[11px] uppercase tracking-wider text-charcoal/50 hover:text-bronze"
        >
          ← Admin console
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Edit problem
        </h1>
        <p className="mt-1 font-mono text-xs text-charcoal/50">{challenge.slug}</p>
        <div className="mt-8">
          <ProblemForm initial={challenge} />
        </div>
      </section>
    </main>
  );
}
