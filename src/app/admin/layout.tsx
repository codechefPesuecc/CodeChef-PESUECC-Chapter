import AdminNav from "@/components/admin/AdminNav";

/**
 * Presentational shell for every /admin/* page — just the shared nav row.
 *
 * NOT the security boundary. Layouts render around a page but don't run
 * instead of it, so gating here would still let a direct request reach a
 * page's data fetch before this ever redirects. Every page under /admin
 * keeps its own `getAdminUser()` + `redirect("/")` and its own
 * `export const dynamic = "force-dynamic"` — see src/app/admin/page.tsx:14
 * for why the dynamic export matters: without it the static-asset cache
 * interceptor can serve the page without ever running the gate.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-4xl px-6 pt-6">
        <AdminNav />
      </div>
      {children}
    </>
  );
}
