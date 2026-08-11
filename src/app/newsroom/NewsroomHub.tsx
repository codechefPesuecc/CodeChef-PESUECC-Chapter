"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useMotionTemplate,
  AnimatePresence,
} from "motion/react";
import { useMemo, useState, useEffect } from "react";
import type { EventData } from "@/lib/events";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

type FilterKey =
  | "all"
  | "completed"
  | "upcoming"
  | "hackathon"
  | "workshop"
  | "hunt";

type Props = { events: EventData[] };

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "upcoming", label: "Upcoming" },
  { key: "hackathon", label: "Hackathons" },
  { key: "workshop", label: "Workshops" },
  { key: "hunt", label: "Hunts" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function classifyEvent(event: EventData) {
  const type = event.type.toLowerCase();
  if (type.includes("workshop")) return "workshop";
  if (type.includes("hunt")) return "hunt";
  return "hackathon";
}

function matchesFilter(event: EventData, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "completed") return event.status === "completed";
  if (filter === "upcoming") return event.status === "upcoming";
  return classifyEvent(event) === filter;
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */

export default function NewsroomHub({ events }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const filteredEvents = useMemo(
    () => events.filter((e) => matchesFilter(e, activeFilter)),
    [activeFilter, events],
  );

  const filterCounts = useMemo(() => {
    const c = new Map<FilterKey, number>();
    for (const f of FILTERS) c.set(f.key, 0);
    events.forEach((event) => {
      c.set("all", (c.get("all") ?? 0) + 1);
      if (event.status === "completed")
        c.set("completed", (c.get("completed") ?? 0) + 1);
      else c.set("upcoming", (c.get("upcoming") ?? 0) + 1);
      const b = classifyEvent(event);
      c.set(b, (c.get(b) ?? 0) + 1);
    });
    return c;
  }, [events]);

  const featured = filteredEvents[0] ?? null;
  const archive = filteredEvents.slice(1);
  const upcomingEvents = events.filter(
    (e) => e.status === "upcoming" && e.registrationUrl,
  );

  return (
    <>
      {/* ============================================================ */}
      {/*  HERO — Matches InitiativesHero pattern exactly              */}
      {/* ============================================================ */}
      <section className="relative -mt-24 overflow-hidden pt-24">
        {/* Technical grid backdrop */}
        <div aria-hidden className="absolute inset-0 bg-tech-grid-main" />
        <div
          aria-hidden
          className="absolute right-0 top-24 h-72 w-72 rounded-full bg-bronze/10 blur-3xl"
        />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-10 text-center lg:pb-20 lg:pt-16">
          <span className="inline-flex items-center rounded-full border border-bronze/25 bg-panel/75 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-bronze shadow-sm backdrop-blur">
            Stories · Recaps · Updates
          </span>

          <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.02] tracking-tight text-chocolate sm:text-6xl lg:text-7xl dark:text-cream">
            Newsroom
          </h1>

          <p className="mx-auto mt-6 text-pretty text-lg leading-8 text-charcoal/78 dark:text-cream/70">
            Event recaps, contest results, announcements, and stories from the
            heart of the CodeChef PESUECC Chapter.
          </p>

          {/* Filter pills */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.key;
              const count = filterCounts.get(filter.key) ?? 0;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`relative isolate rounded-full px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none ${
                    active
                      ? "text-chocolate dark:text-cream"
                      : "text-charcoal/50 hover:text-chocolate dark:text-cream/40 dark:hover:text-cream"
                  }`}
                  aria-pressed={active}
                >
                  {active && (
                    <motion.span
                      layoutId="newsroom-filter"
                      className="absolute inset-0 -z-10 rounded-full border border-bronze/25 bg-panel/80 shadow-sm backdrop-blur"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  )}
                  {filter.label}
                  <span className="ml-1.5 text-[10px] text-charcoal/30 dark:text-cream/30">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FEATURED STORY                                              */}
      {/* ============================================================ */}
      {featured && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-20">
          <FeaturedStoryCard
            event={featured}
            reduceMotion={Boolean(reduceMotion)}
          />
        </section>
      )}

      {/* ============================================================ */}
      {/*  ARCHIVE GRID                                                */}
      {/* ============================================================ */}
      {archive.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 sm:pb-28">
          <div className="mb-10 max-w-2xl">
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-bronze">
              Archive
            </span>
            <h2 className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight text-chocolate sm:text-5xl dark:text-cream">
              Past stories
            </h2>
            <p className="mt-3 text-pretty leading-7 text-charcoal/70 dark:text-cream/60">
              Swipe the top card or click &quot;Next&quot; to browse through our
              event history.
            </p>
          </div>

          <StoryStack
            stories={archive}
            reduceMotion={Boolean(reduceMotion)}
          />
        </section>
      )}

      {/* ============================================================ */}
      {/*  UPCOMING EVENTS BANNER                                      */}
      {/* ============================================================ */}
      {upcomingEvents.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          {upcomingEvents.map((event) => (
            <UpcomingBanner key={event.slug} event={event} />
          ))}
        </section>
      )}

      {/* Empty state */}
      {filteredEvents.length === 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <EmptyState onReset={() => setActiveFilter("all")} />
        </section>
      )}
    </>
  );
}

/* ================================================================== */
/*  FEATURED STORY — Full-width editorial card                         */
/* ================================================================== */

function FeaturedStoryCard({
  event,
  reduceMotion,
}: {
  event: EventData;
  reduceMotion: boolean;
}) {
  const isUpcoming = event.status === "upcoming";

  return (
    <article className="group relative w-full overflow-hidden rounded-3xl bg-black shadow-xl">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={event.image}
          alt={event.title}
          fill
          priority
          sizes="100vw"
          className={`object-cover ${
            reduceMotion
              ? ""
              : "transition-transform duration-700 group-hover:scale-105"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0906] via-[#0d0906]/55 to-[#0d0906]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0906]/70 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-[460px] flex-col justify-end p-8 sm:min-h-[520px] sm:p-12 lg:p-16">
        <div className="max-w-3xl">
          {/* Badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-bronze px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white">
              Featured
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white/80 backdrop-blur">
              {event.type}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white/80 backdrop-blur">
              {event.date}
            </span>
            {isUpcoming && (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-amber-200 backdrop-blur">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                Upcoming
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-balance font-display text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {event.title}
          </h2>

          <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-bronze">
            {event.tagline}
          </p>

          <p className="mt-5 max-w-2xl text-pretty leading-7 text-white/70">
            {event.summary}
          </p>

          {/* Highlights */}
          <div className="mt-6 flex flex-wrap gap-5">
            {event.highlights.slice(0, 4).map((h) => (
              <div key={h.label}>
                <div className="font-display text-xl font-bold text-white sm:text-2xl">
                  {h.value}
                </div>
                <div className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                  {h.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/newsroom/${event.slug}`}
              className="group/btn inline-flex items-center gap-2 border-[1.5px] border-white bg-transparent px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white transition-all duration-300 hover:bg-white hover:text-chocolate"
            >
              Read Full Story
              <span className="inline-block transition-transform duration-300 group-hover/btn:translate-x-1">
                →
              </span>
            </Link>

            {isUpcoming && event.registrationUrl && (
              <Link
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-bronze px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-bronze/80"
              >
                Register Now →
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ================================================================== */
/*  SWIPEABLE 3D STACK                                                 */
/* ================================================================== */

function StoryStack({
  stories,
  reduceMotion,
}: {
  stories: EventData[];
  reduceMotion: boolean;
}) {
  const [cards, setCards] = useState(stories);

  useEffect(() => {
    setCards(stories);
  }, [stories]);

  const moveToEnd = () => {
    setCards((prev) => {
      if (prev.length <= 1) return prev;
      const [top, ...rest] = prev;
      return [...rest, top];
    });
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ height: 560 }}>
      <AnimatePresence mode="popLayout">
        {cards.map((event, index) => {
          const isTop = index === 0;
          if (index >= 4) return null;

          return (
            <motion.div
              key={event.slug}
              layout
              initial={{ opacity: 0, y: 100, scale: 0.85 }}
              animate={{
                opacity: 1 - index * 0.2,
                y: index * 32,
                scale: 1 - index * 0.04,
                zIndex: cards.length - index,
              }}
              exit={{ opacity: 0, scale: 0.85, y: -60 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 22,
                mass: 0.8,
              }}
              className={`absolute inset-x-0 top-0 ${
                isTop
                  ? "cursor-grab active:cursor-grabbing"
                  : "pointer-events-none"
              }`}
              style={{
                filter: index > 0 ? `blur(${index * 1.2}px)` : "none",
              }}
              drag={isTop && !reduceMotion ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={(_e, info) => {
                if (
                  Math.abs(info.offset.x) > 80 ||
                  Math.abs(info.velocity.x) > 400
                ) {
                  moveToEnd();
                }
              }}
            >
              <StackCard event={event} reduceMotion={reduceMotion} />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute -bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-4">
        <button
          type="button"
          onClick={moveToEnd}
          className="group/btn inline-flex items-center gap-2 border-[1.5px] border-chocolate/20 bg-transparent px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-chocolate transition-all duration-300 hover:bg-chocolate hover:text-cream dark:border-cream/20 dark:text-cream dark:hover:bg-cream dark:hover:text-chocolate"
        >
          Next Story
          <span className="inline-block transition-transform duration-300 group-hover/btn:translate-x-1">
            →
          </span>
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-charcoal/35 dark:text-cream/30">
          {cards.length} stories
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STACK CARD                                                         */
/* ================================================================== */

function StackCard({
  event,
  reduceMotion,
}: {
  event: EventData;
  reduceMotion: boolean;
}) {
  const canHover = !reduceMotion;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cardGlow = useMotionValue(0);
  const spotlight = useMotionTemplate`radial-gradient(300px circle at ${mouseX}px ${mouseY}px, rgba(166,124,82,0.08), transparent 60%)`;

  return (
    <article className="relative w-full select-none shadow-xl">
      <div
        className="group block h-full w-full"
        onMouseMove={(e) => {
          if (!canHover) return;
          const r = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - r.left);
          mouseY.set(e.clientY - r.top);
          cardGlow.set(1);
        }}
        onMouseLeave={() => cardGlow.set(0)}
      >
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-hairline bg-panel shadow-sm dark:border-cream/10 dark:bg-[#15110e]">
          {/* Spotlight */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              backgroundImage: canHover ? spotlight : "none",
              opacity: canHover ? cardGlow : 0,
            }}
          />

          <div className="grid gap-0 sm:grid-cols-5">
            {/* Image */}
            <div className="relative aspect-[16/9] w-full overflow-hidden sm:col-span-2 sm:aspect-auto sm:h-full">
              <Image
                src={event.image}
                alt={event.title}
                fill
                draggable={false}
                loading="lazy"
                sizes="(min-width: 640px) 40vw, 100vw"
                className={`object-cover grayscale-[0.15] ${
                  canHover
                    ? "transition-transform duration-700 group-hover:scale-105 group-hover:grayscale-0"
                    : ""
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/5" />
            </div>

            {/* Content */}
            <div className="flex h-full flex-col justify-between p-6 sm:col-span-3 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brown/20 bg-transparent px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-brown dark:text-bronze">
                    {event.type}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-charcoal/40 dark:text-cream/35">
                    {event.date}
                  </span>
                </div>

                <h3 className="mt-4 text-balance font-display text-xl font-bold leading-[1.15] tracking-tight text-chocolate transition-colors duration-300 group-hover:text-brown sm:text-2xl dark:text-cream dark:group-hover:text-bronze">
                  {event.title}
                </h3>

                <p className="mt-3 line-clamp-2 text-sm leading-7 text-charcoal/70 dark:text-cream/55">
                  {event.summary}
                </p>

                {/* Inline highlights */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {event.highlights.slice(0, 3).map((h) => (
                    <span
                      key={h.label}
                      className="rounded-full border border-brown/15 bg-transparent px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-charcoal/50 dark:border-cream/10 dark:text-cream/40"
                    >
                      {h.value} {h.label}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                href={`/newsroom/${event.slug}`}
                draggable={false}
                className="group/btn mt-6 inline-flex w-fit items-center gap-2 border-[1.5px] border-chocolate/20 bg-transparent px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-chocolate transition-all duration-300 hover:bg-chocolate hover:text-cream dark:border-cream/20 dark:text-cream dark:hover:bg-cream dark:hover:text-chocolate"
                onClick={(e) => e.stopPropagation()}
              >
                Read More
                <span className="inline-block transition-transform duration-300 group-hover/btn:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ================================================================== */
/*  UPCOMING EVENTS BANNER                                             */
/* ================================================================== */

function UpcomingBanner({ event }: { event: EventData }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-panel p-8 shadow-sm sm:p-10 dark:border-cream/10 dark:bg-[#15110e]">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Upcoming Event
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight text-chocolate dark:text-cream">
            {event.title}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-charcoal/50 dark:text-cream/40">
            {event.date} · {event.location}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/newsroom/${event.slug}`}
            className="border-[1.5px] border-chocolate/20 bg-transparent px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-chocolate transition-all hover:bg-chocolate hover:text-cream dark:border-cream/20 dark:text-cream dark:hover:bg-cream dark:hover:text-chocolate"
          >
            Learn More
          </Link>
          {event.registrationUrl && (
            <Link
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-bronze px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-bronze/80"
            >
              Register Now →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  EMPTY STATE                                                        */
/* ================================================================== */

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-12 text-center shadow-sm dark:border-cream/10 dark:bg-[#15110e]">
      <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-chocolate dark:text-cream">
        No stories match this filter
      </h2>
      <p className="mx-auto mt-3 max-w-md text-pretty leading-7 text-charcoal/70 dark:text-cream/60">
        Try another category to see more chapter updates, recap posts, and event
        highlights.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 border-[1.5px] border-chocolate/20 bg-transparent px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-chocolate transition-all hover:bg-chocolate hover:text-cream dark:border-cream/20 dark:text-cream dark:hover:bg-cream dark:hover:text-chocolate"
      >
        Show all stories
      </button>
    </div>
  );
}
