"use client";

import { usePathname } from "next/navigation";
import { BookOpen, FileCode2, KeyRound, ListChecks, Trophy, type LucideIcon } from "lucide-react";
import Link from "@/components/AppLink";
import { useParticipantState } from "./ParticipantStateProvider";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/algohunt/challenge", label: "Question", icon: FileCode2 },
  { href: "/algohunt/code", label: "Enter code", icon: KeyRound },
  { href: "/algohunt/progress", label: "Progress", icon: ListChecks },
  { href: "/algohunt/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/algohunt/rules", label: "Rules", icon: BookOpen },
];

/** Contract §13 nav: a top tab row on desktop, a fixed bottom tab bar on phones. */
export default function ParticipantNav() {
  const pathname = usePathname();
  const { state } = useParticipantState();
  const codePending = state.current?.state === "CODE_PENDING";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav aria-label="AlgoHunt" className="mecha-tabs hidden sm:inline-flex">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`mecha-tab relative inline-flex items-center gap-1.5 ${isActive(href) ? "mecha-tab--active" : ""}`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {label}
            {href === "/algohunt/code" && codePending && <CodeDot />}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="AlgoHunt"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-panel/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide ${
                  isActive(href) ? "text-bronze" : "text-charcoal/60"
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden className="h-5 w-5" />
                  {href === "/algohunt/code" && codePending && <CodeDot />}
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function CodeDot() {
  return (
    <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-panel">
      <span className="sr-only">Code needed</span>
    </span>
  );
}
