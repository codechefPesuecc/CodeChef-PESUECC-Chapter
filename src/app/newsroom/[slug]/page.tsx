import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { events, getEventBySlug } from "@/lib/events";
import Reveal from "@/components/Reveal";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import type { CSSProperties } from "react";

/* ---------- Static params for SSG ---------- */

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

/* ---------- Dynamic metadata ---------- */

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return { title: "Event Not Found" };
  return {
    title: event.title,
    description: event.summary,
  };
}

/* ---------- Page ---------- */

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative -mt-24 overflow-hidden pt-24">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={event.image}
            alt={event.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-chocolate/80 via-chocolate/60 to-[var(--site-canvas)] dark:from-[#0d0906]/90 dark:via-[#0d0906]/70 dark:to-[var(--site-canvas)]"
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-20">
          <Reveal>
            {/* Breadcrumb */}
            <Link
              href="/newsroom"
              className="group mb-6 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cream/70 transition-colors hover:text-bronze"
            >
              <span className="transition-transform group-hover:-translate-x-0.5">
                ←
              </span>
              Back to Newsroom
            </Link>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="mecha-chip bg-bronze/90 text-white">
                {event.type}
              </span>
              <span
                className={`mecha-chip ${
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

            {/* Title */}
            <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-cream sm:text-5xl lg:text-6xl">
              {event.title}
            </h1>
            <p className="mt-3 font-mono text-sm font-semibold uppercase tracking-wider text-bronze">
              {event.tagline}
            </p>

            {/* Date & Location */}
            <div className="mt-6 flex flex-wrap gap-6 text-sm text-cream/70">
              <span className="inline-flex items-center gap-2">
                <CalendarIcon />
                {event.date}
              </span>
              <span className="inline-flex items-center gap-2">
                <PinIcon />
                {event.location}
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Highlights Ledger */}
      <section className="relative z-20 mx-auto -mt-12 max-w-6xl px-6 sm:-mt-16">
        <Reveal>
          <MechaPanel>
            <div className="grid gap-px bg-hairline sm:grid-cols-4">
              {event.highlights.map((h) => (
                <div
                  key={h.label}
                  className="bg-panel px-6 py-8 text-center sm:px-8 sm:py-10"
                >
                  <div className="font-display text-3xl font-bold text-bronze sm:text-4xl">
                    {h.value}
                  </div>
                  <div className="mt-2 text-xs font-medium uppercase tracking-wide text-charcoal/60">
                    {h.label}
                  </div>
                </div>
              ))}
            </div>
          </MechaPanel>
        </Reveal>
      </section>

      {/* About the Event */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Main content */}
          <div className="lg:col-span-3">
            <Reveal>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
                About the Event
              </span>
              <h2 className="mt-3 text-balance font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
                What happened at {event.title}
              </h2>
              <div className="mt-6 space-y-5">
                {event.description.map((para, i) => (
                  <p
                    key={i}
                    className="text-pretty leading-7 text-charcoal/80"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Event Image */}
          <div className="lg:col-span-2">
            <Reveal delay={0.15}>
              <MechaPanel label={event.type} index={event.date}>
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    sizes="(min-width: 1024px) 35vw, 100vw"
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-chocolate/50 via-transparent to-transparent dark:from-[#0d0906]/60"
                  />
                </div>
              </MechaPanel>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Schedule / Timeline */}
      {event.schedule && event.schedule.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16 sm:pb-20">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
              Timeline
            </span>
            <h2 className="mt-3 text-balance font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
              Event Schedule
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {event.schedule.map((item, i) => (
              <Reveal key={i} delay={i * 0.05} className="h-full">
                <MechaPanel
                  className="h-full"
                  bodyClassName="flex items-start gap-4 p-5"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-bronze/10 font-mono text-xs font-bold text-bronze">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze/80">
                      {item.time}
                    </div>
                    <div className="mt-1 text-sm font-medium text-chocolate">
                      {item.activity}
                    </div>
                  </div>
                </MechaPanel>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <MechaPanel
            style={
              {
                "--mecha-fill": "#1e1610",
                "--mecha-line": "var(--color-bronze)",
              } as CSSProperties
            }
            bodyClassName="relative px-8 py-14 text-center sm:px-16"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-bronze/25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-brown/40 blur-3xl"
            />
            <div className="relative">
              <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
                Explore more events
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-cream/70">
                Check out our other events and stay tuned for what&apos;s coming
                next from the CodeChef PESUECC Chapter.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  href="/newsroom"
                  className="group mecha-btn mecha-btn--solid"
                >
                  All Events
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
                <Link href="/cp-arena" className="mecha-btn mecha-btn--ghost">
                  Enter the Arena
                </Link>
              </div>
            </div>
          </MechaPanel>
        </Reveal>
      </section>
    </main>
  );
}

/* --- Icons --- */

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
