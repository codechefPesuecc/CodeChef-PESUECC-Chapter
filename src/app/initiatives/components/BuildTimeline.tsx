import Reveal from "@/components/Reveal";
import { SectionIntro } from "./Shared";

const TIMELINE_STEPS = [
  {
    step: "01",
    title: "Ideate",
    body: "Start with a campus problem: learning gaps, contest friction, event scale, or solver motivation.",
  },
  {
    step: "02",
    title: "Build",
    body: "Turn the idea into a usable system with tight scopes, real interfaces, and measurable outcomes.",
  },
  {
    step: "03",
    title: "Test",
    body: "Put it in front of students early, observe failure modes, and tune the experience before launch.",
  },
  {
    step: "04",
    title: "Launch",
    body: "Run the initiative as a live operation with clear ownership, support loops, and technical monitoring.",
  },
  {
    step: "05",
    title: "Iterate",
    body: "Fold learnings back into the next event, platform release, or competitive programming track.",
  },
];

export function BuildTimeline() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <SectionIntro
        eyebrow="Operating model"
        title="How an initiative becomes a system"
        body="The chapter builds in loops: discover the need, ship the smallest real thing, run it live, and compound the learning."
      />

      <div className="relative mt-12 rounded-3xl border border-hairline bg-panel/60 p-8 shadow-sm backdrop-blur-md sm:p-12">
        <div
          aria-hidden
          className="absolute left-12 top-8 h-[calc(100%-4rem)] w-px bg-hairline lg:left-12 lg:top-20 lg:h-px lg:w-[calc(100%-6rem)]"
        />
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-5">
          {TIMELINE_STEPS.map((item, i) => (
            <Reveal key={item.step} delay={i * 0.06}>
              <article className="relative pl-12 lg:pl-0 lg:pt-12">
                <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-bronze/35 bg-panel font-mono text-[10px] font-bold text-bronze shadow-sm">
                  {item.step}
                </span>
                <h3 className="font-display text-lg font-bold text-chocolate">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-charcoal/68">
                  {item.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
