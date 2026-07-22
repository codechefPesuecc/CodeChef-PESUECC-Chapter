import Link from "next/link";
import Reveal from "@/components/Reveal";
import { stats } from "./data";
import { TechnicalBackdrop, ArrowIcon } from "./Shared";

export function InitiativesHero() {
  return (
    <section className="relative -mt-24 overflow-hidden pt-24">
      <TechnicalBackdrop />
      <div className="relative z-10 mx-auto grid w-[92%] max-w-[1440px] gap-10 pt-10 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-16 lg:pb-20">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-bronze/25 bg-panel/75 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-bronze shadow-sm backdrop-blur">
            Product studio · Engineering lab
          </span>
          <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-chocolate sm:text-6xl lg:text-7xl">
            Initiatives
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-charcoal/78">
            Learning pipelines, event engines, and competitive programming
            infrastructure built by the CodeChef PESUECC Chapter for students who
            want to solve harder, ship faster, and operate at real scale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#flagship-events"
              className="inline-flex items-center gap-2 rounded-lg bg-bronze px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-bronze/90 hover:shadow-md"
            >
              Explore Systems
              <ArrowIcon />
            </Link>
            <Link
              href="/cp-arena"
              className="inline-flex items-center gap-2 rounded-lg border border-brown px-5 py-3 text-sm font-semibold text-brown transition-colors hover:bg-brown hover:text-white dark:hover:text-[#16110c]"
            >
              CP Arena
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="relative rounded-2xl border border-hairline bg-panel/88 p-4 shadow-xl backdrop-blur">
            <div className="rounded-xl border border-hairline bg-[#16110c] p-4 text-cream shadow-inner">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e06c5b]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e0b24b]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#5bbf7a]" />
                <span className="ml-2 font-mono text-[11px] text-cream/45">
                  initiatives.ops
                </span>
              </div>
              <div className="grid gap-3 pt-4 sm:grid-cols-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="font-display text-2xl font-bold text-bronze">
                      {stat.value}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-cream/50">
                      {stat.label}
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-bronze"
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 font-mono text-xs text-cream/70">
                status: building campus-scale technical culture
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
