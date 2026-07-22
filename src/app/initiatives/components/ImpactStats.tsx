import Reveal from "@/components/Reveal";
import { stats } from "./data";

export function ImpactStats() {
  return (
    <section className="mx-auto w-[92%] max-w-[1440px] pb-16">
      <Reveal>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline shadow-xl sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-panel px-6 py-7">
              <div className="font-display text-3xl font-bold text-brown">
                {stat.value}
              </div>
              <div className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal/55">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
