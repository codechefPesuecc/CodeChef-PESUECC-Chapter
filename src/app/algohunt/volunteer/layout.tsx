import type { Metadata } from "next";
import Link from "next/link";
import { getVolunteerContext } from "@/server/algohunt/volunteers";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Check-in Desk · AlgoHunt 2.0",
};

export const dynamic = "force-dynamic";

export default async function VolunteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="lc-panel max-w-md p-6 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-chocolate">Log in first</h1>
          <p className="text-sm text-charcoal/70">
            You must be signed in with an authorized account to access the check-in desk.
          </p>
          <div>
            <Link href="/login" className="mecha-btn mecha-btn--solid text-sm">
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ctx = await getVolunteerContext();
  if (!ctx) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="lc-panel max-w-md p-6 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-chocolate">Volunteer Access Required</h1>
          <p className="text-sm text-charcoal/70">
            You&apos;re not assigned as an AlgoHunt volunteer. Ask the organizers to grant access.
          </p>
          <div>
            <Link href="/" className="mecha-btn mecha-btn--ghost text-sm">
              Return Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-charcoal">
      <header className="border-b border-hairline bg-panel/80 backdrop-blur sticky top-0 z-40 px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm tracking-tight text-chocolate">
              AlgoHunt 2.0
            </span>
            <span className="text-hairline">·</span>
            <span className="font-mono text-xs text-bronze uppercase">Check-in desk</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-charcoal/60">
            <span>@{ctx.user.username}</span>
            {ctx.isAdmin && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-bronze/15 text-bronze font-bold">
                ADMIN
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
