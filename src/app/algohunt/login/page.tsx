import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import TeamLoginForm from "@/components/algohunt/auth/TeamLoginForm";
import { getCurrentTeam, signedOutByAnotherDevice } from "@/server/algohunt/teamSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AlgoHunt 2.0 | Team log in" };

export default async function AlgoHuntLoginPage() {
  if (await getCurrentTeam()) redirect("/algohunt");
  const replaced = await signedOutByAnotherDevice();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <MechaPanel label="TEAM ACCESS" index="AH 2.0" className="w-full max-w-md">
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-bold">AlgoHunt 2.0</h1>
            <p className="mt-2 text-sm opacity-75">Log in with your team credentials.</p>
          </div>
          {replaced && (
            <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-100">
              Your team logged in on another device, so this one was signed out. Logging in here signs the other one out.
            </p>
          )}
          <TeamLoginForm />
          <p className="text-sm leading-relaxed opacity-75">
            Use the team code and password on your team&apos;s slip. One laptop per team: logging in here signs out any other device using your team code. Phones are only for scanning QR codes.
          </p>
        </div>
      </MechaPanel>
    </main>
  );
}
