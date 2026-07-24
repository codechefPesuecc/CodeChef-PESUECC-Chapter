import Reveal from "@/components/Reveal";
import { TechnicalBackdrop } from "./Shared";

export function InitiativesHero() {
  return (
    <section className="relative -mt-24 overflow-hidden pt-24">
      <TechnicalBackdrop />
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-10 pb-16 lg:pt-16 lg:pb-20 text-center flex flex-col items-center">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-bronze/25 bg-panel/75 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-bronze shadow-sm backdrop-blur">
            Product studio · Engineering lab
          </span>
          <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-chocolate sm:text-6xl lg:text-7xl">
            Initiatives
          </h1>
          <p className="mt-6 text-pretty text-lg leading-8 text-charcoal/78 mx-auto">
            Learning pipelines, event engines, and competitive programming
            infrastructure built by the CodeChef PESUECC Chapter for students who
            want to solve harder, ship faster, and operate at real scale.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
