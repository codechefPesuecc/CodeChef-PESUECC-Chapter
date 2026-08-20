import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { getAdminUser } from "@/server/auth/session";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import TeacherManagementPanel from "@/components/admin/TeacherManagementPanel";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const db = getDb();
  const teacherRows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
    })
    .from(users)
    .where(eq(users.isTeacher, true));

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-bronze">
            Management
          </p>
          <h1 className="font-display text-3xl font-bold text-chocolate">
            Teacher Management
          </h1>
          <p className="text-sm text-charcoal/60 mt-2">
            Promote or demote users to teacher status for Monstr contest creation.
          </p>
        </div>

        <TeacherManagementPanel teachers={teacherRows} />
      </section>
    </main>
  );
}
