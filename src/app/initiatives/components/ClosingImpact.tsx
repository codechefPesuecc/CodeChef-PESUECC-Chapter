import Link from "next/link";
import Reveal from "@/components/Reveal";

export function ClosingImpact() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-panel shadow-xl ring-1 ring-hairline">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-bronze)_18%,transparent),transparent_38%),linear-gradient(to_right,color-mix(in_oklab,var(--color-hairline)_58%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-hairline)_58%,transparent)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]"
          />
          <div className="relative grid gap-8 px-7 py-10 sm:px-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12 lg:py-12">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
                Built for the next launch
              </span>
              <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
                We turn chapter energy into repeatable technical systems.
              </h2>
              <p className="mt-4 max-w-2xl text-pretty leading-7 text-charcoal/70">
                From beginner pipelines to judge-backed contests, every initiative
                is designed to make the next cohort sharper and the next event
                easier to scale.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">

              <Link
                href="/team"
                className="inline-flex items-center gap-2 rounded-lg border border-brown px-5 py-3 text-sm font-semibold text-brown transition-colors hover:bg-brown hover:text-white dark:hover:text-[#16110c]"
              >
                Meet the Team
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
