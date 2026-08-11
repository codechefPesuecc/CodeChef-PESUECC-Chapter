"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useMotionValue, useMotionTemplate, useSpring, AnimatePresence } from "motion/react";
import { useMemo, useState, useEffect } from "react";
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

  const featuredStory = filteredEvents.length > 0 ? filteredEvents[0] : null;
  const remainingStories = filteredEvents.slice(1);

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
            className="relative rounded-[2.5rem] border border-white/20 bg-white/60 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-black/25 sm:p-12"
            style={{ backdropFilter: "blur(16px)" }}
          >
            <div className="absolute inset-0 rounded-[2.5rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.34),transparent_35%,transparent_65%,rgba(255,255,255,0.06))]" />
            <div className="relative">
              <span className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-bronze/90">
                Newsroom
              </span>
              <h1 className="mt-4 max-w-3xl text-balance font-display text-5xl font-extrabold tracking-tight text-chocolate sm:text-6xl lg:text-7xl">
                The Chapter's Pulse.
              </h1>
              <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-charcoal/80 sm:text-xl sm:leading-9 dark:text-cream/80">
                Dive into the stories, breakthroughs, and recaps from the heart of the CodeChef PESUECC community.
              </p>

              <div className="mt-10 inline-flex max-w-full overflow-x-auto no-scrollbar rounded-full border border-white/20 bg-white/70 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
                <div className="flex flex-nowrap items-center gap-1.5 px-2">
                  {FILTERS.map((filter) => {
                    const active = activeFilter === filter.key;
                    const count = filterCounts.get(filter.key) ?? 0;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className={`relative isolate whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors focus-visible:outline-none ${
                          active ? "text-chocolate dark:text-cream" : "text-chocolate/70 hover:text-bronze dark:text-cream/60 dark:hover:text-cream"
                        }`}
                        aria-pressed={active}
                      >
                        {active && (
                          <motion.span
                            layoutId="newsroom-filter-pill"
                            className="absolute inset-0 -z-10 rounded-full border border-bronze/20 bg-white shadow-[0_10px_24px_rgba(166,124,82,0.16)] dark:bg-white/10"
                            transition={{ type: "spring", stiffness: 520, damping: 42 }}
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-2.5">
                          <span>{filter.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.12em] ${
                            active ? "bg-bronze/10 text-bronze dark:bg-white/20" : "bg-black/5 text-charcoal/50 dark:bg-white/5 dark:text-cream/50"
                          }`}>
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

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
        {featuredStory ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-24"
          >
            {/* Phase 3 Editorial Cinematic Hero */}
            <FeaturedStoryCard event={featuredStory} reduceMotion={Boolean(reduceMotion)} />
            
            {remainingStories.length > 0 && (
              <div>
                <div className="mb-12 flex flex-col items-center justify-center text-center">
                  <h3 className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-bronze">
                    The Archive Stack
                  </h3>
                  <p className="mt-3 text-sm text-charcoal/60 dark:text-cream/60">
                    <span className="hidden sm:inline">Swipe or drag the top card to shuffle through our history.</span>
                    <span className="sm:hidden">Swipe the top card to shuffle through our history.</span>
                  </p>
                </div>
                {/* Phase 3 Interactive Swipeable Deck */}
                <StoryStack stories={remainingStories} reduceMotion={Boolean(reduceMotion)} />
              </div>
            )}
          </motion.div>
        ) : (
          <EmptyState onReset={() => setActiveFilter("all")} />
        )}
      </section>
    </>
  );
}

function StoryStack({ stories, reduceMotion }: { stories: EventData[]; reduceMotion: boolean }) {
  const [cards, setCards] = useState(stories);

  useEffect(() => {
    setCards(stories);
  }, [stories]);

  const moveToEnd = (fromIndex: number) => {
    setCards((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.push(item);
      return next;
    });
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl h-[650px] perspective-1000">
      <AnimatePresence mode="popLayout">
        {cards.map((event, index) => {
          const isTop = index === 0;
          return (
            <motion.div
              key={event.slug}
              layout
              initial={{ opacity: 0, y: 100, scale: 0.8 }}
              animate={{
                opacity: index < 5 ? 1 - index * 0.15 : 0,
                y: index * 36,
                scale: 1 - index * 0.05,
                zIndex: cards.length - index,
                rotateX: index * 1.5,
              }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.8 }}
              className={`absolute inset-x-0 top-0 transition-[filter,opacity] duration-300 ${
                isTop 
                  ? "cursor-grab active:cursor-grabbing hover:-translate-y-2" 
                  : "pointer-events-none drop-shadow-xl"
              }`}
              style={{
                filter: index > 0 ? `blur(${index * 1}px)` : "blur(0px)",
              }}
              drag={isTop && !reduceMotion ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, info) => {
                const swipeThreshold = 100;
                const velocityThreshold = 500;
                if (
                  Math.abs(info.offset.x) > swipeThreshold || 
                  Math.abs(info.velocity.x) > velocityThreshold
                ) {
                  moveToEnd(0);
                }
              }}
            >
              <StackedStoryCard event={event} reduceMotion={reduceMotion} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function FeaturedStoryCard({ event, reduceMotion }: { event: EventData; reduceMotion: boolean }) {
  const canTilt = !reduceMotion;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const tiltX = useSpring(0, { stiffness: 240, damping: 24 });
  const tiltY = useSpring(0, { stiffness: 240, damping: 24 });

  return (
    <motion.article
      layout
      className="group relative w-full overflow-hidden rounded-[2.5rem] sm:rounded-[3.5rem] shadow-[0_40px_100px_rgba(15,23,42,0.2)] bg-black"
      onMouseMove={(eventMouse) => {
        if (!canTilt) return;
        const rect = eventMouse.currentTarget.getBoundingClientRect();
        const x = eventMouse.clientX - rect.left;
        const y = eventMouse.clientY - rect.top;
        mouseX.set(x);
        mouseY.set(y);

        const offsetX = (x - rect.width / 2) / rect.width;
        const offsetY = (y - rect.height / 2) / rect.height;
        tiltX.set(Math.max(-3, Math.min(3, offsetY * -6)));
        tiltY.set(Math.max(-3, Math.min(3, offsetX * 6)));
      }}
      onMouseLeave={() => {
        tiltX.set(0);
        tiltY.set(0);
      }}
      style={{
        transformStyle: canTilt ? "preserve-3d" : "flat",
        rotateX: tiltX,
        rotateY: tiltY,
      }}
    >
      <div className="absolute inset-0">
        <Image
          src={event.image}
          alt={event.title}
          fill
          priority
          sizes="100vw"
          className="object-cover transition duration-[2000ms] ease-out group-hover:scale-105 group-hover:blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0906] via-[#0d0906]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0906]/90 via-[#0d0906]/40 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[500px] sm:min-h-[600px] flex-col justify-end p-8 sm:p-14 lg:p-20">
        <div className="max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-bronze px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-white shadow-xl">
              Featured Story
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-white/90 backdrop-blur-md">
              {event.date}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-white/90 backdrop-blur-md">
              {event.type}
            </span>
          </div>

          <h2 className="text-balance font-display text-4xl font-extrabold tracking-tighter text-white sm:text-5xl md:text-6xl lg:text-[5rem] lg:leading-[1.05]">
            {event.title}
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-lg font-medium leading-relaxed text-cream/80 sm:text-xl">
            {event.summary}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href={`/newsroom/${event.slug}`}
              className="group/btn relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-white px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-chocolate transition-transform hover:scale-105 hover:bg-cream"
            >
              Read Full Story
              <span className="transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function StackedStoryCard({ event, reduceMotion }: { event: EventData; reduceMotion: boolean }) {
  const canTilt = !reduceMotion;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cardOpacity = useMotionValue(0);

  const internalSpotlight = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.15), transparent 58%)`;

  return (
    <article className="relative w-full shadow-2xl">
      <div
        className="group block h-full w-full select-none"
        onMouseMove={(eventMouse) => {
          if (!canTilt) return;
          const rect = eventMouse.currentTarget.getBoundingClientRect();
          const x = eventMouse.clientX - rect.left;
          const y = eventMouse.clientY - rect.top;
          mouseX.set(x);
          mouseY.set(y);
          cardOpacity.set(1);
        }}
        onMouseLeave={() => {
          cardOpacity.set(0);
        }}
      >
        <motion.div
          className="relative h-full w-full overflow-hidden rounded-[2rem] border border-white/20 bg-white/80 shadow-[0_15px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/10 dark:bg-[#15110e]"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
            style={{
              backgroundImage: canTilt
                ? internalSpotlight
                : "radial-gradient(250px circle at 50% 50%, rgba(255,255,255,0.05), transparent 58%)",
              opacity: canTilt ? cardOpacity : 0,
            }}
          />

          <div className="grid gap-0 sm:grid-cols-2">
            <div className="relative aspect-[16/9] sm:aspect-auto sm:h-full w-full overflow-hidden">
              <Image
                src={event.image}
                alt={event.title}
                fill
                draggable={false}
                loading="lazy"
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-700 grayscale-[0.2] group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <div className="absolute left-4 top-4">
                <span className="mecha-chip border border-white/10 backdrop-blur bg-white/10 text-white shadow-xl">
                  {event.type}
                </span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between p-8 sm:p-10">
              <div>
                <div className="mecha__telemetry px-0 pt-0 pb-3">
                  <span className="mecha__index">{event.date}</span>
                </div>
                <h2 className="mt-1 text-balance font-display text-2xl font-bold tracking-tight text-chocolate dark:text-cream transition-colors duration-300 group-hover:text-bronze">
                  {event.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-charcoal/78 dark:text-cream/78 line-clamp-3">
                  {event.summary}
                </p>
              </div>
              
              <Link 
                href={`/newsroom/${event.slug}`}
                draggable={false}
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-bronze/20 bg-bronze/10 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-bronze transition-colors hover:bg-bronze hover:text-white"
                onClick={(e) => {
                  // If they drag over the button, don't trigger the link
                  // This is a naive way, but standard clicking works fine
                  e.stopPropagation(); 
                }}
              >
                Read More
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </article>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[2.5rem] border border-white/20 bg-white/60 p-12 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-bronze/20 bg-bronze/10">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 rounded-full border border-bronze/20" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bronze" />
        </div>
      </div>
      <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-chocolate dark:text-cream">
        No stories match this filter
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-pretty text-lg leading-8 text-charcoal/75 dark:text-cream/75">
        Try another category to see more chapter updates, recap posts, and event
        highlights.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-bronze px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_16px_36px_rgba(166,124,82,0.25)] transition-transform duration-200 hover:-translate-y-1"
      >
        Show all stories
      </button>
    </div>
  );
}
