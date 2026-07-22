import Reveal from "@/components/Reveal";
import { systems } from "./data";
import { SectionIntro } from "./Shared";

export function SystemsPortfolio() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div className="absolute inset-0 bg-chocolate dark:bg-[#0f0b07]" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(166,124,82,0.28),transparent_28%),radial-gradient(circle_at_82%_45%,rgba(245,241,235,0.1),transparent_24%),linear-gradient(to_right,rgba(245,241,235,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,241,235,0.07)_1px,transparent_1px)] bg-[size:auto,auto,36px_36px,36px_36px]"
      />
      <div className="relative z-10 mx-auto w-[92%] max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-end">
          <SectionIntro
            dark
            eyebrow="Engineered systems"
            title="Infrastructure behind the chapter's best moments"
            body="These are not side projects. They are the operating layer: registration flows, contest engines, sandboxed judging, live standings, and event-control surfaces that make launches repeatable."
          />
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-cream/10 bg-cream/[0.05] p-5 shadow-2xl backdrop-blur">
              <div className="grid gap-px overflow-hidden rounded-xl bg-cream/10 sm:grid-cols-3">
                {[
                  { label: "Operations", value: "Control" },
                  { label: "Execution", value: "Sandbox" },
                  { label: "Feedback", value: "Live" },
                ].map((item) => (
                  <div key={item.label} className="bg-[#16110c]/78 px-5 py-4">
                    <div className="font-display text-2xl font-bold text-bronze">
                      {item.value}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-cream/42">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-12 space-y-8">
          {systems.map((system, i) => (
            <SystemPanel key={system.id} system={system} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemPanel({
  system,
  delay,
}: {
  system: (typeof systems)[number];
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <article className="relative overflow-hidden rounded-3xl border border-cream/10 bg-cream/[0.055] shadow-2xl backdrop-blur">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(110deg,rgba(166,124,82,0.18),transparent_34%),linear-gradient(to_right,rgba(245,241,235,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,241,235,0.06)_1px,transparent_1px)] bg-[size:auto,30px_30px,30px_30px]"
        />
        <div className="relative grid gap-0 lg:grid-cols-[0.38fr_0.62fr]">
          <div className="border-b border-cream/10 p-6 sm:p-8 lg:border-r lg:border-b-0">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze">
              {system.role}
            </span>
            <h3 className="mt-3 font-display text-4xl font-bold tracking-tight text-cream">
              {system.title}
            </h3>
            <p className="mt-4 text-pretty text-sm leading-7 text-cream/64">
              {system.description}
            </p>

            <div className="mt-8 grid gap-px overflow-hidden rounded-xl bg-cream/10">
              {system.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center justify-between bg-[#16110c]/72 px-4 py-3"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-cream/42">
                    {metric.label}
                  </span>
                  <span className="font-display text-lg font-bold text-bronze">
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid gap-4 xl:grid-cols-[1fr_0.88fr]">
              <div className="rounded-2xl border border-cream/10 bg-[#16110c] p-4 shadow-inner">
                <div className="flex items-center gap-2 border-b border-cream/10 pb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e06c5b]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e0b24b]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#5bbf7a]" />
                  <span className="ml-2 font-mono text-[11px] text-cream/45">
                    runtime.log
                  </span>
                </div>
                <div className="space-y-2 pt-4 font-mono text-xs">
                  {system.terminal.map((line, i) => (
                    <div
                      key={line}
                      className={i === 0 ? "text-bronze" : "text-cream/60"}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-cream/10 bg-cream/[0.04] p-4">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze">
                  System flow
                </div>
                <div className="mt-4 space-y-3">
                  {system.pipeline.map((item, i) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bronze/35 bg-bronze/10 font-mono text-[10px] font-bold text-bronze">
                        0{i + 1}
                      </span>
                      <div className="flex-1 rounded-lg border border-cream/10 bg-[#16110c]/45 px-3 py-2 text-sm font-semibold text-cream/78">
                        {item}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-cream/10 bg-cream/[0.04] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {["Auth", "Queue", "Judge", "Scoreboard", "Ops Console"].map(
                  (node, i) => (
                    <div key={node} className="flex items-center gap-2">
                      <span className="rounded-full border border-cream/10 bg-[#16110c]/60 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cream/64">
                        {node}
                      </span>
                      {i < 4 && <span className="text-bronze/70">→</span>}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
