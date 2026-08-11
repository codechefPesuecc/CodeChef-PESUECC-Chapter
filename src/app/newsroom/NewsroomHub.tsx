"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useMotionValue, useMotionTemplate, useSpring } from "motion/react";
import { useMemo, useState } from "react";
import type { EventData } from "@/lib/events";

type FilterKey = "all" | "featured" | "completed" | "upcoming" | "hackathon" | "workshop" | "hunt";

type Props = {
  events: EventData[];
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "featured", label: "Featured" },
  { key: "completed", label: "Completed" },
  { key: "upcoming", label: "Upcoming" },
  { key: "hackathon", label: "Hackathons" },
  { key: "workshop", label: "Workshops" },
  { key: "hunt", label: "Hunts" },
];

function classifyEvent(event: EventData) {
  const type = event.type.toLowerCase();
  if (type.includes("workshop")) return "workshop";
  if (type.includes("hunt")) return "hunt";
  return "hackathon";
}

function matchesFilter(event: EventData, filter: FilterKey, index: number) {
  if (filter === "all") return true;
  if (filter === "featured") return index === 0;
  if (filter === "completed") return event.status === "completed";
  if (filter === "upcoming") return event.status === "upcoming";
  return classifyEvent(event) === filter;
}

export default function NewsroomHub({ events }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlightOpacity = useMotionValue(0);
  const spotlightStyle = useMotionTemplate`radial-gradient(700px circle at ${mouseX}px ${mouseY}px, rgba(181,138,95,0.22), transparent 48%), radial-gradient(500px circle at 22% 22%, rgba(166,124,82,0.12), transparent 55%)`;

  const filteredEvents = useMemo(
    () => events.filter((event, index) => matchesFilter(event, activeFilter, index)),
    [activeFilter, events],
  );

  const filterCounts = useMemo(() => {
    const counts = new Map<FilterKey, number>();
    for (const filter of FILTERS) counts.set(filter.key, 0);

    events.forEach((event, index) => {
      counts.set("all", (counts.get("all") ?? 0) + 1);
      if (index === 0) counts.set("featured", (counts.get("featured") ?? 0) + 1);
      if (event.status === "completed") {
        counts.set("completed", (counts.get("completed") ?? 0) + 1);
      } else {
        counts.set("upcoming", (counts.get("upcoming") ?? 0) + 1);
      }

      const bucket = classifyEvent(event);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    });

    return counts;
  }, [events]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.5))] dark:bg-[linear-gradient(180deg,rgba(19,14,10,0.88),rgba(19,14,10,0.68))]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_circle_at_22%_22%,rgba(166,124,82,0.12),transparent_55%)]" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            backgroundImage: spotlightStyle,
            opacity: spotlightOpacity,
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bronze/40 to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <div
            onPointerMove={(event) => {
              if (reduceMotion) return;
              const rect = event.currentTarget.getBoundingClientRect();
              mouseX.set(event.clientX - rect.left);
              mouseY.set(event.clientY - rect.top);
              spotlightOpacity.set(1);
            }}
            onPointerLeave={() => spotlightOpacity.set(0)}
            className="relative rounded-[2rem] border border-white/20 bg-white/60 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-black/25 sm:p-8"
            style={{ backdropFilter: "blur(16px)" }}
          >
            <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.34),transparent_35%,transparent_65%,rgba(255,255,255,0.06))]" />
            <div className="relative">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-bronze/90">
                Newsroom
              </span>
              <h1 className="mt-3 max-w-3xl text-balance font-display text-4xl font-bold tracking-tight text-chocolate sm:text-5xl lg:text-6xl">
                Latest from the chapter
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-charcoal/80 sm:text-lg sm:leading-8 dark:text-cream/80">
                Announcements, event recaps, contest results, and stories from the
                CodeChef PESUECC community.
              </p>

              <div className="mt-8 inline-flex max-w-full rounded-full border border-white/20 bg-white/70 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
                <div className="flex flex-wrap gap-1">
                  {FILTERS.map((filter) => {
                    const active = activeFilter === filter.key;
                    const count = filterCounts.get(filter.key) ?? 0;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className="relative isolate rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-chocolate transition-colors hover:text-bronze focus-visible:outline-none dark:text-cream/80"
                        aria-pressed={active}
                      >
                        {active && (
                          <motion.span
                            layoutId="newsroom-filter-pill"
                            className="absolute inset-0 -z-10 rounded-full border border-bronze/20 bg-white/95 shadow-[0_10px_24px_rgba(166,124,82,0.16)] dark:bg-white/10"
                            transition={{ type: "spring", stiffness: 520, damping: 42 }}
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-2">
                          <span>{filter.label}</span>
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] tracking-[0.12em] text-charcoal/60 dark:bg-white/10 dark:text-cream/70">
                            {count}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        {filteredEvents.length > 0 ? (
          <motion.div
            className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {filteredEvents.map((event, index) => (
              <NewsroomCard
                key={event.slug}
                event={event}
                featured={index === 0}
                delay={reduceMotion ? 0 : index === 0 ? 0.05 : 0.12 + Math.abs(index - 1) * 0.08}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </motion.div>
        ) : (
          <EmptyState onReset={() => setActiveFilter("all")} />
        )}
      </section>
    </>
  );
}

function NewsroomCard({
  event,
  featured,
  delay,
  reduceMotion,
}: {
  event: EventData;
  featured: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const canTilt = !reduceMotion;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const tiltX = useSpring(0, { stiffness: 240, damping: 24 });
  const tiltY = useSpring(0, { stiffness: 240, damping: 24 });
  const cardOpacity = useMotionValue(0);

  const internalSpotlight = useMotionTemplate`radial-gradient(220px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.35), transparent 58%)`;

  return (
    <motion.article
      layout
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.9, delay }}
      className={`relative ${featured ? "md:col-span-2 xl:col-span-2" : ""}`}
    >
      <Link
        href={`/newsroom/${event.slug}`}
        className="group block h-full"
        onMouseMove={(eventMouse) => {
          if (!canTilt) return;
          const rect = eventMouse.currentTarget.getBoundingClientRect();
          const x = eventMouse.clientX - rect.left;
          const y = eventMouse.clientY - rect.top;
          mouseX.set(x);
          mouseY.set(y);
          cardOpacity.set(1);

          const offsetX = (x - rect.width / 2) / rect.width;
          const offsetY = (y - rect.height / 2) / rect.height;
          tiltX.set(Math.max(-10, Math.min(10, offsetY * -18)));
          tiltY.set(Math.max(-10, Math.min(10, offsetX * 18)));
        }}
        onMouseLeave={() => {
          tiltX.set(0);
          tiltY.set(0);
          cardOpacity.set(0);
        }}
      >
        <motion.div
          className="relative h-full overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/70 shadow-[0_20px_70px_rgba(15,23,42,0.09)] backdrop-blur-xl transition-transform duration-200 dark:border-white/10 dark:bg-black/25 group-hover:z-10 group-hover:scale-[1.01]"
          style={{
            backdropFilter: "blur(16px)",
            transformStyle: canTilt ? "preserve-3d" : "flat",
            rotateX: tiltX,
            rotateY: tiltY,
          }}
          whileTap={reduceMotion ? { scale: 1 } : { scale: 0.98 }}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
            style={{
              backgroundImage: canTilt
                ? internalSpotlight
                : "radial-gradient(220px circle at 50% 50%, rgba(255,255,255,0.18), transparent 58%)",
              opacity: canTilt ? cardOpacity : 0,
            }}
          />

          <div className={featured ? "grid gap-0 xl:grid-cols-5" : "grid gap-0"}>
            <div className={featured ? "relative aspect-[4/3] overflow-hidden xl:col-span-3" : "relative aspect-[4/3] overflow-hidden"}>
              <Image
                src={event.image}
                alt={event.title}
                fill
                loading="lazy"
                sizes={featured ? "(min-width: 1280px) 55vw, (min-width: 768px) 66vw, 100vw" : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
                className="object-cover transition duration-700 grayscale-[0.2] group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-chocolate/85 via-chocolate/20 to-transparent dark:from-[#0d0906]/90" />

              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span className="mecha-chip bg-bronze/90 text-white shadow-[0_0_12px_rgba(166,124,82,0.35)] backdrop-blur">
                  {event.type}
                </span>
              </div>

              <div className="absolute right-4 top-4">
                <span
                  className={`mecha-chip border border-white/10 backdrop-blur ${
                    event.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.18)]"
                      : "animate-pulse bg-amber-500/20 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.24)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      event.status === "completed" ? "bg-emerald-300" : "bg-amber-200"
                    }`}
                  />
                  {event.status === "completed" ? "Completed" : "Upcoming"}
                </span>
              </div>

              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-cream backdrop-blur">
                <CalendarIcon />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream/90">
                  {event.date}
                </span>
              </div>
            </div>

            <div className={featured ? "flex h-full flex-col justify-between p-6 sm:p-7 xl:col-span-2" : "flex h-full flex-col p-6"}>
              <div>
                <div className="mecha__telemetry px-0 pt-0 pb-3">
                  <span className="mecha__label">
                    {featured ? "Featured story" : "Chapter update"}
                  </span>
                  <span className="mecha__index">{event.date}</span>
                </div>
                <h2 className={`mt-3 text-balance font-display font-bold tracking-tight text-chocolate dark:text-cream transition-colors duration-300 group-hover:text-bronze ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>
                  {event.title}
                </h2>
                <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-bronze/85">
                  {event.tagline}
                </p>
                <p className="mt-4 text-sm leading-7 text-charcoal/78 dark:text-cream/78">
                  {event.summary}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {event.highlights.slice(0, 2).map((highlight) => (
                    <div
                      key={highlight.label}
                      className="rounded-2xl border border-white/15 bg-white/55 px-3 py-3 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-colors duration-300 group-hover:border-bronze/20 dark:bg-black/20"
                    >
                      <div className="font-display text-lg font-bold text-bronze">
                        {highlight.value}
                      </div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal/55 dark:text-cream/55">
                        {highlight.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <MagneticReadMore reduceMotion={reduceMotion} />
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.article>
  );
}

function MagneticReadMore({ reduceMotion }: { reduceMotion: boolean }) {
  const x = useSpring(0, { stiffness: 260, damping: 20 });
  const y = useSpring(0, { stiffness: 260, damping: 20 });

  return (
    <span
      className="mt-6 inline-flex w-fit items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-bronze transition-colors group-hover:text-chocolate dark:group-hover:text-cream"
      onMouseMove={(event) => {
        if (reduceMotion) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance > 100) {
          x.set(0);
          y.set(0);
          return;
        }
        x.set(dx * 0.25);
        y.set(dy * 0.25);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      Read More
      <motion.span style={{ x, y }}>
        →
      </motion.span>
    </span>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/20 bg-white/60 p-10 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-bronze/20 bg-bronze/10">
        <div className="relative h-10 w-10">
          <span className="absolute inset-0 rounded-full border border-bronze/20" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bronze" />
        </div>
      </div>
      <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-chocolate dark:text-cream">
        No stories match this filter
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-pretty leading-7 text-charcoal/75 dark:text-cream/75">
        Try another category to see more chapter updates, recap posts, and event
        highlights.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-bronze px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_16px_36px_rgba(166,124,82,0.25)] transition-transform duration-200 hover:-translate-y-0.5"
      >
        Show all stories
      </button>
    </div>
  );
}

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