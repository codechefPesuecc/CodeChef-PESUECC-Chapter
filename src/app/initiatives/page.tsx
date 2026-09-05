import type { Metadata } from "next";
import { InitiativesHero } from "./components/InitiativesHero";
import { ImpactStats } from "./components/ImpactStats";
import { getAllEvents, getAllSystems } from "@/lib/initiatives";
import dynamic from "next/dynamic";

const FlagshipEvents = dynamic(() => import("./components/FlagshipEvents").then(m => m.FlagshipEvents));
const SystemsPortfolio = dynamic(() => import("./components/SystemsPortfolio").then(m => m.SystemsPortfolio));
const BuildTimeline = dynamic(() => import("./components/BuildTimeline").then(m => m.BuildTimeline));
const ClosingImpact = dynamic(() => import("./components/ClosingImpact").then(m => m.ClosingImpact));

export const metadata: Metadata = {
  title: "Initiatives",
  description:
    "Learning pipelines, event engines, and competitive programming infrastructure built by the CodeChef PESUECC Chapter.",
};

export default function InitiativesPage() {
  const events = getAllEvents();
  const systems = getAllSystems();

  return (
    <main className="flex-1">
      <InitiativesHero />
      <ImpactStats eventsCount={events.length} systemsCount={systems.length} />
      <FlagshipEvents events={events} />
      <SystemsPortfolio systems={systems} />
      <BuildTimeline />
      <ClosingImpact />
    </main>
  );
}
