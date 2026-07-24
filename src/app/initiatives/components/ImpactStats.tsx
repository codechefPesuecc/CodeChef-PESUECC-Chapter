import Link from "next/link";
import Reveal from "@/components/Reveal";
import { ArrowIcon } from "./Shared";

export function ImpactStats() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <Reveal>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline shadow-xl sm:grid-cols-2 lg:grid-cols-4">
          
          <Link href="#flagship-events" className="group flex flex-col bg-panel px-6 py-7 hover:bg-cream dark:hover:bg-[#1C1714] transition-colors">
            <div className="font-display text-3xl font-bold text-brown">3+</div>
            <div className="mt-2 flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal/55">
              Flagship Events
              <span className="text-bronze opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                <ArrowIcon />
              </span>
            </div>
          </Link>

          <Link href="#engineered-events" className="group flex flex-col bg-panel px-6 py-7 hover:bg-cream dark:hover:bg-[#1C1714] transition-colors">
            <div className="font-display text-3xl font-bold text-brown">2</div>
            <div className="mt-2 flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal/55">
              Engineered Events
              <span className="text-bronze opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                <ArrowIcon />
              </span>
            </div>
          </Link>

          <div className="flex flex-col bg-panel px-6 py-7">
            <div className="font-display text-3xl font-bold text-brown">500+</div>
            <div className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal/55">
              Students Reached
            </div>
          </div>

          <div className="flex flex-col bg-panel px-6 py-7">
            <div className="font-display text-3xl font-bold text-brown">Daily CP</div>
            <div className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal/55">
              Active Culture
            </div>
          </div>

        </div>
      </Reveal>
    </section>
  );
}
