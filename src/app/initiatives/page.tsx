import type { Metadata } from "next";
import { InitiativesHero } from "./components/InitiativesHero";
import { ImpactStats } from "./components/ImpactStats";
import { FlagshipEvents } from "./components/FlagshipEvents";
import { SystemsPortfolio } from "./components/SystemsPortfolio";
import { BuildTimeline } from "./components/BuildTimeline";
import { ClosingImpact } from "./components/ClosingImpact";

export const metadata: Metadata = {
  title: "Initiatives",
  description:
    "Learning pipelines, event engines, and competitive programming infrastructure built by the CodeChef PESUECC Chapter.",
};

export default function InitiativesPage() {
  return (
    <main className="flex-1">
      <InitiativesHero />
      <ImpactStats />
      <FlagshipEvents />
      <SystemsPortfolio />
      <BuildTimeline />
      <ClosingImpact />
    </main>
  );
}
