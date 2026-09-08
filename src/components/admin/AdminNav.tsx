"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/AppLink";

const LINKS = [
  { href: "/admin", label: "CP Arena" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/recruitment", label: "Recruitment" },
];

/**
 * Shared nav across every /admin/* page. Presentational only — it draws no
 * security boundary. Each page still gates itself via getAdminUser() +
 * redirect("/") (and, for the API routes, its own getAdminUser() check too);
 * see src/app/admin/layout.tsx for why the layout can't be that boundary.
 */
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-4">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`font-mono text-xs uppercase tracking-wider font-medium transition ${
              active ? "text-chocolate hover:text-bronze" : "text-charcoal/60 hover:text-chocolate"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
