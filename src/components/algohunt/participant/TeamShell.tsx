"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Link from "@/components/AppLink";
import AnnouncementStrip from "./AnnouncementStrip";
import ParticipantNav from "./ParticipantNav";
import { useParticipantState } from "./ParticipantStateProvider";
import StatusBanners from "./StatusBanners";
import StatusChip from "./StatusChip";

/** The team shell every participant page sits in: header, nav, banners, announcement strip. */
export default function TeamShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useParticipantState();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logOut() {
    if (loggingOut || !window.confirm("Log out on this device?")) return;
    setLoggingOut(true);
    try {
      await fetch("/api/algohunt/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // The cookie may survive a failed request; the login page still lets them back in.
    }
    router.replace("/algohunt/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-12">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link href="/algohunt" className="font-display text-lg font-bold tracking-tight">
            AlgoHunt 2.0
          </Link>
          <p className="truncate text-xs text-charcoal/60">
            {state.team.name} · <span className="font-mono">{state.team.code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip kind={state.nextStep.kind} />
          <button
            type="button"
            onClick={logOut}
            disabled={loggingOut}
            className="mecha-btn mecha-btn--ghost mecha-btn--sm"
          >
            <LogOut aria-hidden className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </header>
      <ParticipantNav />
      <StatusBanners />
      <AnnouncementStrip />
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </main>
  );
}
