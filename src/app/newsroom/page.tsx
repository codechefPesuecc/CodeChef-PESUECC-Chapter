import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { events } from "@/lib/events";
import Reveal from "@/components/Reveal";
import MechaPanel from "@/components/cp-arena/MechaPanel";

export const metadata: Metadata = {
  title: "Newsroom",
  description:
    "Announcements, event recaps, contest results, and stories from the CodeChef PESUECC Chapter.",
};

export default function NewsroomPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 sm:py-20">
      <Reveal>
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
          Newsroom
        </span>
        <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight text-chocolate sm:text-5xl">
          Latest from the chapter
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-lg leading-8 text-charcoal/80">
          Announcements, event recaps, contest results, and stories from the
          CodeChef PESUECC community.
        </p>
      </Reveal>

      {/* Events Grid */}
      <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event, i) => (
          <Reveal key={event.slug} delay={i * 0.1} className="h-full">
            <Link href={`/newsroom/${event.slug}`} className="group block h-full">
              <MechaPanel
                ticks
                className="h-full transition-transform duration-300 group-hover:-translate-y-2"
                bodyClassName="flex h-full flex-col"
              >
                {/* Event Image */}
                <div className="relative aspect-[3/2] w-full overflow-hidden">
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-chocolate/70 via-transparent to-transparent dark:from-[#0d0906]/80"
                  />
                  {/* Event type chip */}
                  <div className="absolute left-3 top-3">
                    <span className="mecha-chip bg-bronze/90 text-white backdrop-blur">
                      {event.type}
                    </span>
                  </div>
                  {/* Status badge */}
                  <div className="absolute right-3 top-3">
                    <span
                      className={`mecha-chip backdrop-blur ${
                        event.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          event.status === "completed"
                            ? "bg-emerald-400"
                            : "bg-amber-400 animate-pulse"
                        }`}
                      />
                      {event.status === "completed" ? "Completed" : "Upcoming"}
                    </span>
                  </div>
                  {/* Date overlay */}
                  <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-chocolate/70 px-3 py-1 backdrop-blur dark:bg-[#0d0906]/70">
                    <CalendarIcon />
                    <span className="font-mono text-xs text-cream">
                      {event.date}
                    </span>
                  </div>
                </div>

                {/* Event Info */}
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-xl font-bold text-chocolate transition-colors group-hover:text-bronze">
                    {event.title}
                  </h2>
                  <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-wider text-bronze/80">
                    {event.tagline}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-6 text-charcoal/75">
                    {event.summary}
                  </p>

                  {/* Quick stats */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {event.highlights.slice(0, 2).map((h) => (
                      <div
                        key={h.label}
                        className="rounded-lg bg-bronze/5 px-3 py-2 text-center"
                      >
                        <div className="font-display text-lg font-bold text-bronze">
                          {h.value}
                        </div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-charcoal/50">
                          {h.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Read more */}
                  <div className="mt-5 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-bronze transition-colors group-hover:text-chocolate">
                    Read More
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              </MechaPanel>
            </Link>
          </Reveal>
        ))}
      </div>
    </main>
  );
}

/* --- Icons --- */

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-cream/80"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
