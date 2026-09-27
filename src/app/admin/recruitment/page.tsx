import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/session";
import { getRecruitmentSettings } from "@/server/recruitment";
import { getAdminApplications } from "@/server/recruitment-applications";
import RecruitmentPanel from "@/components/admin/RecruitmentPanel";

export const metadata: Metadata = { title: "Recruitment" };

// Reads the session + DB and gates on admin — never prerender/cache.
export const dynamic = "force-dynamic";

export default async function AdminRecruitmentPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const [settings, applications] = await Promise.all([
    getRecruitmentSettings(),
    getAdminApplications(),
  ]);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Recruitment Dashboard
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Manage recruitment cycles, review candidate applications, and export data.
        </p>

        <div className="mt-6">
          <RecruitmentPanel initialSettings={settings} initialApplications={applications} />
        </div>
      </section>
    </main>
  );
}
