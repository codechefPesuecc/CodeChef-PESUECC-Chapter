import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { events } from "./data";
import { SectionIntro, MetaPill, ArrowIcon } from "./Shared";

export function FlagshipEvents() {
  return (
    <section id="flagship-events" className="mx-auto w-[92%] max-w-[1440px] py-16 sm:py-20">
      <SectionIntro
        eyebrow="Flagship events"
        title="Scroll through the event engines"
        body="Each initiative keeps its operating brief pinned while the visual archive changes beside it, making the page feel like a product story rather than a static list."
      />

      <div className="mt-12 space-y-20 lg:space-y-28">
        {events.map((event, i) => (
          <EventScrollStory key={event.id} event={event} index={i} />
        ))}
      </div>
    </section>
  );
}

function EventScrollStory({
  event,
  index,
}: {
  event: (typeof events)[number];
  index: number;
}) {
  return (
    <article className="grid gap-10 lg:grid-cols-[0.55fr_0.45fr] lg:items-start xl:grid-cols-[0.6fr_0.4fr]">
      <div className="lg:sticky lg:top-28">
        <Reveal delay={index * 0.05}>
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-panel p-6 shadow-sm sm:p-8">
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-hairline)_58%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-hairline)_58%,transparent)_1px,transparent_1px)] bg-[size:28px_28px] opacity-25"
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-full border border-bronze/25 bg-bronze/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze">
                    {event.category}
                  </span>
                  <span className="font-mono text-sm font-bold text-bronze/55">
                    {event.accent}
                  </span>
                </div>
                <h3 className="mt-6 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
                  {event.title}
                </h3>
                <p className="mt-4 max-w-3xl text-pretty text-base leading-7 text-charcoal/72">
                  {event.description}
                </p>

                <div className="mt-7 grid gap-2">
                  {event.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-center gap-3 rounded-lg border border-hairline bg-cream/40 px-3 py-2 text-sm text-charcoal/75 dark:bg-white/[0.03]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
                      {highlight}
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap gap-2 border-t border-hairline pt-5">
                  <MetaPill label="Status" value={event.status} />
                  <MetaPill label="Cadence" value={event.cadence} />
                </div>

                <Link
                  href={event.href}
                  className="mt-7 inline-flex items-center gap-2 rounded-lg bg-chocolate px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition-all hover:bg-brown dark:bg-bronze dark:text-white dark:hover:bg-bronze/90"
                >
                  Know more
                  <ArrowIcon />
                </Link>
              </div>
            </div>
        </Reveal>
      </div>

      <div className="space-y-6 lg:min-h-[155vh]">
        {event.gallery.map((photo, photoIndex) => (
          <div
            key={`${event.id}-${photo.caption}`}
            className="lg:sticky lg:top-28"
          >
            <Reveal delay={photoIndex * 0.04}>
              <div
                className="group overflow-hidden rounded-2xl border border-hairline bg-panel shadow-xl"
                style={{ zIndex: photoIndex + 1 }}
              >
                <div className="relative aspect-[4/3] min-h-[320px] lg:min-h-[520px]">
                  <Image
                    src={photo.src}
                    alt={`${event.title}: ${photo.caption}`}
                    fill
                    priority={photoIndex === 0}
                    sizes="(min-width: 1024px) 54vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#16110c]/82 via-[#16110c]/12 to-transparent"
                  />
                  <div className="absolute top-4 left-4 rounded-full border border-white/15 bg-[#16110c]/55 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-cream/80 backdrop-blur">
                    {String(photoIndex + 1).padStart(2, "0")} /{" "}
                    {String(event.gallery.length).padStart(2, "0")}
                  </div>
                  <div className="absolute right-4 bottom-4 left-4">
                    <div className="max-w-md font-display text-2xl font-bold text-cream">
                      {photo.caption}
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-cream/50">
                      {event.title} visual archive
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </article>
  );
}
