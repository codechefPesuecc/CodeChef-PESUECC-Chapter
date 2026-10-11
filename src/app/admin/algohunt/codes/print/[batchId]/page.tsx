import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/session";
import PrintSheet from "@/components/admin/algohunt/codes/PrintSheet";

export const metadata: Metadata = {
  title: "Print Code Batch · AlgoHunt Admin",
};

export const dynamic = "force-dynamic";

export default async function PrintBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const { batchId } = await params;

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-2">
        <PrintSheet batchId={batchId} />
      </section>
    </main>
  );
}
