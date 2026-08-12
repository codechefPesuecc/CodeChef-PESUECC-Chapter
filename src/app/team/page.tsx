import type { Metadata } from "next";
import { getAllTeamData } from "./lib";
import TeamPageClient from "./TeamPageClient";

export const metadata: Metadata = {
  title: "Team",
  description:
    "Meet the people behind the CodeChef PESUECC Chapter — coordinators, core team, and members across every year.",
};

/**
 * `/team` — Server Component entry point.
 *
 * Reads the build-time team manifest (see src/app/team/lib.ts) for years and
 * member data, then hands everything to the interactive client shell.
 */
export default function TeamPage() {
  const data = getAllTeamData();
  return <TeamPageClient data={data} />;
}
