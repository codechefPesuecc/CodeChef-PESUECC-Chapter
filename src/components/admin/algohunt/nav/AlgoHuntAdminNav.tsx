"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/AppLink";
import EventSwitcher from "./EventSwitcher";
import {
  NAV_LINKS, isLinkActive, resolveSelectedEvent, switchEventHref, withEvent, type NavEvent,
} from "./navModel";

/**
 * Sub-nav for every /admin/algohunt/* page. Presentational only: it draws no security boundary.
 * Each page and API route still gates itself with getAdminUser().
 */
export default function AlgoHuntAdminNav({ events }: { events: NavEvent[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = resolveSelectedEvent(events, searchParams.get("event"));
  const slug = selected?.slug ?? null;

  return (
    <div className="mb-6 space-y-3 border-b border-hairline pb-3">
      <EventSwitcher
        events={events}
        selected={selected}
        onSelect={(next) => router.push(switchEventHref(pathname, next))}
      />
      <nav aria-label="AlgoHunt admin" className="flex flex-wrap gap-x-4 gap-y-2">
        {NAV_LINKS.map((link) => {
          const active = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={withEvent(link.href, slug)}
              aria-current={active ? "page" : undefined}
              className={`font-mono text-xs uppercase tracking-wider font-medium transition ${
                active ? "text-chocolate hover:text-bronze" : "text-charcoal/60 hover:text-chocolate"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
