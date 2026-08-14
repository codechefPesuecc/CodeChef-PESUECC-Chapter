import type { Metadata } from "next";
import { sortedPosts } from "@/lib/events";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { TechnicalBackdrop } from "@/app/initiatives/components/Shared";
import NewsroomClient from "./NewsroomClient";

export const metadata: Metadata = {
  title: "Newsroom",
  description:
    "Announcements, event recaps, member spotlights, tech news, and stories from the CodeChef PESUECC Chapter.",
};

const metrics = [
  { prefix: "", value: 9, suffix: "+", label: "Published Posts" },
  { prefix: "", value: 3, suffix: "", label: "Event Recaps" },
  { prefix: "", value: 5, suffix: "", label: "Post Types" },
];

export default function NewsroomPage() {
  const pinnedPost = sortedPosts.find((p) => p.pinned);

  return (
    <main className="flex-1 w-full">
      {/* Hero Header */}
      <section className="relative -mt-24 overflow-hidden pt-24">
        <TechnicalBackdrop />
        
        {/* Decorative Background SVG */}
        <svg className="absolute top-24 right-6 w-[300px] h-[300px] opacity-[0.12] dark:opacity-[0.12] pointer-events-none z-0 text-[#8B7A5E] dark:text-[#D98A53]" viewBox="0 0 400 400" fill="none">
          <path d="M400 50 H200 L150 100 V300" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="200" cy="50" r="3" fill="currentColor" />
          <circle cx="150" cy="100" r="3" fill="currentColor" />
          <circle cx="150" cy="300" r="3" fill="currentColor" />
          <path d="M400 80 H280 L230 130 V350" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-32 sm:pt-14 sm:pb-40">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
            <Reveal>
              <span className="inline-flex items-center rounded-full border border-bronze/25 bg-panel/75 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-bronze shadow-sm backdrop-blur">
                Press · Updates · Media
              </span>
              <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-chocolate sm:text-6xl lg:text-7xl">
                The chapter&apos;s voice
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-charcoal/80">
                Announcements, event recaps, member spotlights, and a curated pulse on
                what&apos;s happening in tech — the permanent record of everything the
                CodeChef PESUECC community builds, ships, and celebrates.
              </p>
            </Reveal>

            {/* Live Stats Ledger for Desktop (hidden on mobile, shown on lg+) */}
            <Reveal delay={0.15} className="hidden lg:block">
              <MechaPanel ticks>
                <div className="grid gap-px bg-hairline">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="bg-panel px-6 py-6 text-center">
                      <CountUp
                        value={metric.value}
                        prefix={metric.prefix}
                        suffix={metric.suffix}
                        className="font-display text-3xl font-bold text-brown"
                      />
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/70">
                        {metric.label}
                      </div>
                    </div>
                  ))}
                </div>
              </MechaPanel>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Live Stats Ledger for Mobile (floats over hero edge) */}
      <section className="relative z-20 mx-auto -mt-20 max-w-6xl px-6 sm:-mt-24 lg:hidden">
        <Reveal>
          <MechaPanel>
            <div className="grid gap-px bg-hairline grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="bg-panel px-4 py-6 text-center">
                  <CountUp
                    value={metric.value}
                    prefix={metric.prefix}
                    suffix={metric.suffix}
                    className="font-display text-2xl font-bold text-brown sm:text-3xl"
                  />
                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-charcoal/70 sm:text-[10px]">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </MechaPanel>
        </Reveal>
      </section>

      {/* Client-rendered sections: featured post, filters, grid, tech pulse, CTA */}
      <NewsroomClient posts={sortedPosts} pinnedPost={pinnedPost} />
    </main>
  );
}
