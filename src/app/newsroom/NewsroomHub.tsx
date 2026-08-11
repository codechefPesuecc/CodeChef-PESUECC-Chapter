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
        {featuredStory ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <FeaturedStoryCard event={featuredStory} reduceMotion={Boolean(reduceMotion)} />
            
            {remainingStories.length > 0 && (
              <div className="mt-20">
                <div className="mb-10 text-center">
                  <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-bronze">
                    Previous Stories
                  </h3>
                  <p className="mt-2 text-sm text-charcoal/60 dark:text-cream/60">
                    Click the top card to cycle through our history
                  </p>
                </div>
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

  // Reset the deck when the stories prop changes (e.g. from filtering)
  useEffect(() => {
    setCards(stories);
  }, [stories]);

  const handleCycle = () => {
    if (cards.length > 1) {
      setCards((prev) => {
        const next = [...prev];
        const top = next.shift();
        if (top) next.push(top);
        return next;
      });
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl h-[550px] sm:h-[600px] perspective-1000">
      <AnimatePresence mode="popLayout">
        {cards.map((event, index) => {
          const isTop = index === 0;
          return (
            <motion.div
              key={event.slug}
              layout
              initial={{ opacity: 0, y: 100, scale: 0.8 }}
              animate={{
                opacity: index < 4 ? 1 - index * 0.15 : 0,
                y: index * 32,
                scale: 1 - index * 0.05,
                zIndex: cards.length - index,
                rotateX: index * 2,
              }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.8 }}
              className={`absolute inset-x-0 top-0 transition-all duration-300 ${
                isTop ? "cursor-pointer hover:translate-y-[-8px]" : "pointer-events-none"
              }`}
              onClick={isTop ? handleCycle : undefined}
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
  const cardOpacity = useMotionValue(0);

  const internalSpotlight = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.25), transparent 58%)`;

  return (
    <motion.article
      layout
      className="relative w-full"
    >
      <Link
        href={`/newsroom/${event.slug}`}
        className="group block h-full w-full"
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
          tiltX.set(Math.max(-4, Math.min(4, offsetY * -8)));
          tiltY.set(Math.max(-4, Math.min(4, offsetX * 8)));
        }}
        onMouseLeave={() => {
          tiltX.set(0);
          tiltY.set(0);
          cardOpacity.set(0);
        }}
      >
        <motion.div
          className="relative h-full w-full overflow-hidden rounded-[2rem] border border-white/20 bg-white/70 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-300 dark:border-white/10 dark:bg-black/25 group-hover:z-10 group-hover:scale-[1.01]"
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
                : "radial-gradient(400px circle at 50% 50%, rgba(255,255,255,0.15), transparent 58%)",
              opacity: canTilt ? cardOpacity : 0,
            }}
          />

          <div className="grid gap-0 lg:grid-cols-5">
            <div className="relative aspect-[4/3] lg:aspect-auto h-full w-full overflow-hidden lg:col-span-3">
              <Image
                src={event.image}
                alt={event.title}
                fill
                loading="eager"
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover transition duration-1000 grayscale-[0.2] group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-chocolate/85 via-chocolate/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-chocolate/10 lg:to-chocolate/90 dark:from-[#0d0906]/90 dark:lg:to-[#0d0906]/90" />

              <div className="absolute left-6 top-6 flex flex-wrap gap-2">
                <span className="mecha-chip bg-bronze/90 px-4 py-2 text-sm text-white shadow-[0_0_15px_rgba(166,124,82,0.4)] backdrop-blur">
                  {event.type}
                </span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-center p-8 sm:p-12 lg:col-span-2 lg:bg-chocolate/5 lg:dark:bg-black/20">
              <div>
                <div className="mecha__telemetry px-0 pt-0 pb-4">
                  <span className="mecha__label">Featured story</span>
                  <span className="mecha__index">{event.date}</span>
                </div>
                <h2 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight text-chocolate dark:text-cream sm:text-4xl transition-colors duration-300 group-hover:text-bronze">
                  {event.title}
                </h2>
                <p className="mt-3 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-bronze/85">
                  {event.tagline}
                </p>
                <p className="mt-5 text-base leading-8 text-charcoal/80 dark:text-cream/80">
                  {event.summary}
                </p>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  {event.highlights.slice(0, 2).map((highlight) => (
                    <div
                      key={highlight.label}
                      className="rounded-2xl border border-white/15 bg-white/55 p-4 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-colors duration-300 group-hover:border-bronze/20 dark:bg-black/20"
                    >
                      <div className="font-display text-2xl font-bold text-bronze">
                        {highlight.value}
                      </div>
                      <div className="mt-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal/55 dark:text-cream/55">
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

function StackedStoryCard({ event, reduceMotion }: { event: EventData; reduceMotion: boolean }) {
  const canTilt = !reduceMotion;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const tiltX = useSpring(0, { stiffness: 240, damping: 24 });
  const tiltY = useSpring(0, { stiffness: 240, damping: 24 });
  const cardOpacity = useMotionValue(0);

  const internalSpotlight = useMotionTemplate`radial-gradient(250px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.3), transparent 58%)`;

  return (
    <article className="relative w-full shadow-2xl">
      <div
        className="group block h-full w-full"
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
          tiltX.set(Math.max(-5, Math.min(5, offsetY * -10)));
          tiltY.set(Math.max(-5, Math.min(5, offsetX * 10)));
        }}
        onMouseLeave={() => {
          tiltX.set(0);
          tiltY.set(0);
          cardOpacity.set(0);
        }}
      >
        <motion.div
          className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/80 shadow-[0_15px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl transition-transform duration-300 dark:border-white/10 dark:bg-[#15110e]"
          style={{
            transformStyle: canTilt ? "preserve-3d" : "flat",
            rotateX: tiltX,
            rotateY: tiltY,
          }}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
            style={{
              backgroundImage: canTilt
                ? internalSpotlight
                : "radial-gradient(250px circle at 50% 50%, rgba(255,255,255,0.1), transparent 58%)",
              opacity: canTilt ? cardOpacity : 0,
            }}
          />

          <div className="grid gap-0">
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              <Image
                src={event.image}
                alt={event.title}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-700 grayscale-[0.2] group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <div className="absolute right-4 top-4">
                <span className="mecha-chip border border-white/10 backdrop-blur bg-white/10 text-white shadow-xl">
                  {event.type}
                </span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="mecha__telemetry px-0 pt-0 pb-3">
                  <span className="mecha__index">{event.date}</span>
                </div>
                <h2 className="mt-1 text-balance font-display text-2xl font-bold tracking-tight text-chocolate dark:text-cream transition-colors duration-300 group-hover:text-bronze">
                  {event.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-charcoal/78 dark:text-cream/78 line-clamp-2">
                  {event.summary}
                </p>
              </div>
              
              <Link 
                href={`/newsroom/${event.slug}`}
                className="mt-6 inline-flex w-fit items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-bronze transition-colors hover:text-chocolate dark:hover:text-cream"
                onClick={(e) => e.stopPropagation()} // Prevent clicking the link from cycling the card
              >
                Read More →
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </article>
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
