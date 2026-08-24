import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/server/auth/session";
import { listAllUsers } from "@/server/admin/users";
import UserManagementPanel from "@/components/admin/UserManagementPanel";

export const metadata: Metadata = { title: "User management" };

// Reads the session + DB and gates on admin — never prerender/cache.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const users = await listAllUsers();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 pt-6 pb-24">
        <nav className="mb-6 flex gap-4">
          <Link
            href="/admin"
            className="font-mono text-xs uppercase tracking-wider font-medium text-charcoal/60 hover:text-chocolate transition"
          >
            CP Arena
          </Link>
          <Link
            href="/admin/teachers"
            className="font-mono text-xs uppercase tracking-wider font-medium text-charcoal/60 hover:text-chocolate transition"
          >
            Teachers
          </Link>
          <Link
            href="/admin/users"
            className="font-mono text-xs uppercase tracking-wider font-medium text-chocolate hover:text-bronze transition"
          >
            Users
          </Link>
        </nav>

        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">Admin console</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          User management
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Full platform authority — add or remove accounts and grant admin / teacher roles.
        </p>

        <div className="mt-6">
          <UserManagementPanel initialUsers={users} currentAdminId={admin.id} />
        </div>
      </section>
    </main>
  );
}
