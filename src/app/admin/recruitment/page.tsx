import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/session";
import { getRecruitmentSettings } from "@/server/recruitment";
import RecruitmentPanel from "@/components/admin/RecruitmentPanel";

export const metadata: Metadata = { title: "Recruitment" };

// Reads the session + DB and gates on admin — never prerender/cache.
export const dynamic = "force-dynamic";

export default async function AdminRecruitmentPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const settings = await getRecruitmentSettings();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          Recruitment
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Open or close the drive and point /join at this cycle&apos;s Google Form — no
          deploy needed.
        </p>

        <div className="mt-6">
          <RecruitmentPanel initial={settings} />
        </div>
      </section>
    </main>
  );
}
