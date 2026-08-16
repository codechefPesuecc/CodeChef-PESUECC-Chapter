import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/session";
import ProblemForm from "@/components/admin/ProblemForm";

export const metadata: Metadata = { title: "New problem" };
export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

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
          New problem
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Publishes to CP Arena on its release date — no redeploy. Hidden tests are
          judge-only and never sent to solvers.
        </p>
        <div className="mt-8">
          <ProblemForm />
        </div>
      </section>
    </main>
  );
}
