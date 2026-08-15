"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { upcomingPosts } from "@/lib/events";
import type { NewsPost, PostType } from "@/lib/events";
import Reveal from "@/components/Reveal";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import type { CSSProperties } from "react";

/* ------------------------------------------------------------------ */
/*  Filter config                                                      */
/* ------------------------------------------------------------------ */

const FILTER_TABS: { label: string; value: PostType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Announcements", value: "announcement" },
  { label: "Recaps", value: "recap" },
  { label: "Spotlights", value: "spotlight" },
  { label: "Tech News", value: "tech-news" },
];

/* ------------------------------------------------------------------ */
/*  Type chip color map                                                */
/* ------------------------------------------------------------------ */

function typeChipClasses(type: PostType): string {
  switch (type) {
    case "announcement":
      return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
    case "recap":
      return "bg-bronze/90 text-white";
    case "spotlight":
      return "bg-purple-500/20 text-purple-700 dark:text-purple-300";
    case "tech-news":
      return "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300";
  }
}

function typeLabel(type: PostType): string {
  switch (type) {
    case "announcement":
      return "Announcement";
    case "recap":
      return "Recap";
    case "spotlight":
      return "Spotlight";
    case "tech-news":
      return "Tech News";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewsroomClient({
  posts,
  pinnedPost,
}: {
  posts: NewsPost[];
  pinnedPost: NewsPost | undefined;
}) {
  const [activeFilter, setActiveFilter] = useState<PostType | "all">("all");

  const filtered =
    activeFilter === "all"
      ? posts.filter((p) => !p.pinned)
      : posts.filter((p) => p.type === activeFilter && !p.pinned);

  /* Separate tech-news posts for the Tech Pulse section */
  const techPulseItems = posts.filter((p) => p.type === "tech-news").slice(0, 4);

  return (
    <>
      {/* ---- Featured / Pinned Post ---- */}
      {pinnedPost && (
        <section className="mt-14 mx-auto w-full max-w-6xl px-6">
          <Reveal>
            <div className="group/card block">
              <MechaPanel
                ticks
                className="transition-transform duration-300 group-hover/card:-translate-y-1"
                bodyClassName="p-2 sm:p-3"
              >
                <div className="grid lg:grid-cols-[1fr_auto] gap-px bg-hairline rounded-lg overflow-hidden">
                  {/* Image — left (Chamfered) */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-panel p-2 lg:aspect-auto lg:min-h-[440px]">
                    <div className="relative w-full h-full chamfer-image overflow-hidden">
                      <Image
                        src={pinnedPost.image}
                        alt={pinnedPost.title}
                        fill
                        sizes="(min-width: 1024px) 60vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-chocolate/70 via-transparent to-transparent lg:hidden dark:from-[#0d0906]/80"
                      />
                      {/* Pinned badge */}
                      <div className="absolute left-4 top-4">
                        <span className="mecha-chip bg-amber-500/90 text-white backdrop-blur shadow-lg">
                          <PinIcon />
                          Pinned Feature
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info — right */}
                  <div className="flex flex-col justify-between bg-panel p-8 lg:max-w-md">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-6">
                        <span className={`mecha-chip backdrop-blur ${typeChipClasses(pinnedPost.type)}`}>
                          {typeLabel(pinnedPost.type)}
                        </span>
                        {pinnedPost.status && (
                          <span
                            className={`mecha-chip backdrop-blur ${
                              pinnedPost.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                pinnedPost.status === "completed"
                                  ? "bg-emerald-400"
                                  : "bg-amber-400 animate-pulse"
                              }`}
                            />
                            {pinnedPost.status === "completed" ? "Completed" : "Upcoming"}
                          </span>
                        )}
                      </div>
                      
                      <h2 className="text-balance font-display text-3xl font-extrabold tracking-tight text-chocolate transition-colors group-hover/card:text-bronze sm:text-4xl lg:text-5xl">
                        {pinnedPost.title}
                      </h2>
                      <p className="mt-4 font-display text-xl font-medium leading-tight text-brown/90 border-l-2 border-bronze pl-4">
                        {pinnedPost.tagline}
                      </p>
                      <p className="mt-5 text-pretty text-sm leading-6 text-charcoal/75 line-clamp-3 sm:line-clamp-4">
                        {pinnedPost.summary}
                      </p>
                    </div>

                    <div className="mt-8">
                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-charcoal/50 mb-6">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarIcon />
                          {pinnedPost.date}
                        </span>
                        {pinnedPost.author && (
                          <span className="inline-flex items-center gap-1.5">
                            <UserIcon />
                            {pinnedPost.author}
                          </span>
                        )}
                        {pinnedPost.readTime && (
                          <span className="inline-flex items-center gap-1.5">
                            <ClockIcon />
                            {pinnedPost.readTime}
                          </span>
                        )}
                      </div>

                      {/* Highlights (if any) */}
                      {pinnedPost.highlights && pinnedPost.highlights.length > 0 && (
                        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline border border-hairline">
                          {pinnedPost.highlights.slice(0, 2).map((h) => (
                            <div
                              key={h.label}
                              className="group/bento bg-panel px-4 py-3 transition-colors hover:bg-hairline cursor-default"
                            >
                              <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal/50 transition-colors group-hover/bento:text-bronze">
                                {h.label}
                              </div>
                              <div className="font-display text-xl font-bold text-brown transition-transform origin-left group-hover/bento:scale-105">
                                {h.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CTA Button */}
                      <Link href={`/newsroom/${pinnedPost.slug}`} className="group initiative-btn w-full mt-auto cursor-pointer">
                        Read the full story
                      </Link>
                    </div>
                  </div>
                </div>
              </MechaPanel>
            </div>
          </Reveal>
        </section>
      )}

      {/* ---- Category Filter Bar ---- */}
      <section className="mt-14 mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <div className="mecha-tabs">
              {FILTER_TABS.map((tab) => {
                const count = tab.value === "all" ? posts.filter((p) => !p.pinned).length : posts.filter((p) => p.type === tab.value && !p.pinned).length;
                return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={`mecha-tab ${
                    activeFilter === tab.value ? "mecha-tab--active" : ""
                  }`}
                >
                  {tab.label} <span className="opacity-60 text-[10px] ml-1">({count})</span>
                </button>
              )})}
            </div>
          </div>
          <div className="mt-4 font-mono text-xs text-charcoal/50">
            Showing {filtered.length} of {posts.filter((p) => !p.pinned).length} posts
          </div>
        </Reveal>
      </section>

      {/* ---- Posts Grid ---- */}
      <section className="mt-8 mx-auto w-full max-w-6xl px-6">
        {filtered.length === 0 ? (
          <Reveal>
            <div className="py-20 text-center">
              <p className="font-mono text-sm text-charcoal/50">
                No posts in this category yet. Stay tuned.
              </p>
            </div>
          </Reveal>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Asymmetric first row (Feature + 2 stacked) */}
            {filtered.length >= 3 ? (
              <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
                {/* Feature Card (index 0) */}
                <Reveal delay={0.08} className="h-full">
                  <div className="group/card block h-full">
                    <MechaPanel
                      ticks
                      label={typeLabel(filtered[0].type)}
                      index="01"
                      className="h-full transition-transform duration-300 group-hover/card:-translate-y-2"
                      bodyClassName="flex flex-col p-2 h-full"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md">
                        <Image
                          src={filtered[0].image}
                          alt={filtered[0].title}
                          fill
                          sizes="(min-width: 1024px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                        />
                        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-chocolate/70 via-transparent to-transparent dark:from-[#0d0906]/80" />
                        <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-chocolate/70 px-3 py-1 backdrop-blur dark:bg-[#0d0906]/70">
                          <CalendarIcon className="text-cream/80" />
                          <span className="font-mono text-xs text-cream">{filtered[0].date}</span>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="font-display text-2xl font-bold text-chocolate transition-colors group-hover/card:text-bronze">
                          {filtered[0].title}
                        </h3>
                        <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-wider text-bronze/80">
                          {filtered[0].tagline}
                        </p>
                        <p className="mt-4 flex-1 text-base leading-7 text-charcoal/75 line-clamp-4">
                          {filtered[0].summary}
                        </p>
                        <Link 
                          href={`/newsroom/${filtered[0].slug}`} 
                          className="group mt-4 flex w-max items-center gap-2 text-xs font-semibold text-bronze transition-colors hover:text-chocolate dark:hover:text-cream"
                        >
                          Read article
                          <span className="mecha-btn-arrow">→</span>
                        </Link>
                      </div>
                    </MechaPanel>
                  </div>
                </Reveal>

                {/* Stacked Cards (index 1 and 2) */}
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
                  {[filtered[1], filtered[2]].map((post, i) => (
                    <Reveal key={post.slug} delay={0.16 + (i * 0.08)} className="h-full">
                      <div className="group/card block h-full">
                        <MechaPanel
                          ticks
                          label={typeLabel(post.type)}
                          index={`0${i + 2}`}
                          className="h-full transition-transform duration-300 group-hover/card:-translate-y-2"
                          bodyClassName="flex flex-col lg:flex-row p-2 lg:p-0 h-full"
                        >
                          <div className="relative aspect-[3/2] w-full lg:w-48 lg:aspect-auto flex-shrink-0 overflow-hidden lg:rounded-l-md rounded-t-md lg:rounded-tr-none">
                            <Image
                              src={post.image}
                              alt={post.title}
                              fill
                              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
                              className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                            />
                          </div>
                          <div className="flex flex-1 flex-col p-5">
                            <div className="flex items-center gap-2 mb-2 text-xs text-charcoal/50 font-mono">
                              <CalendarIcon />
                              <span>{post.date}</span>
                            </div>
                            <h3 className="font-display text-lg font-bold text-chocolate transition-colors group-hover/card:text-bronze line-clamp-2">
                              {post.title}
                            </h3>
                            <p className="mt-2 flex-1 text-sm leading-6 text-charcoal/70 line-clamp-2">
                              {post.summary}
                            </p>
                            <Link 
                              href={`/newsroom/${post.slug}`} 
                              className="group mt-4 flex w-max items-center gap-2 text-xs font-semibold text-bronze transition-colors hover:text-chocolate dark:hover:text-cream"
                            >
                              Read article
                              <span className="mecha-btn-arrow">→</span>
                            </Link>
                          </div>
                        </MechaPanel>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            ) : (
              // Fallback if less than 3 posts: just standard grid
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((post, i) => (
                  <PostCard key={post.slug} post={post} index={i} />
                ))}
              </div>
            )}

            {/* Standard Grid for remaining posts */}
            {filtered.length > 3 && (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 pt-4">
                {filtered.slice(3).map((post, i) => (
                  <PostCard key={post.slug} post={post} index={i + 3} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- Coming Next Timeline ---- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20 mt-12">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-sm font-bold uppercase tracking-wider text-bronze dark:text-bronze/90">
            Coming Next
          </span>
          <h2 className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight text-chocolate sm:text-5xl">
            The Editorial Calendar
          </h2>
          <p className="mt-3 text-pretty leading-7 text-charcoal/70">
            A sneak peek at what the chapter is currently writing, filming, and organizing.
          </p>
        </Reveal>

        <div className="relative mt-12 rounded-3xl border border-hairline bg-panel/60 p-8 shadow-sm backdrop-blur-md sm:p-12">
          <div
            aria-hidden
            className="absolute left-12 top-8 h-[calc(100%-4rem)] w-px bg-hairline lg:left-12 lg:top-20 lg:h-px lg:w-[calc(100%-6rem)]"
          />
          <div className="grid gap-8 lg:grid-cols-4 lg:gap-5">
            {upcomingPosts.map((item, i) => (
              <Reveal key={item.step} delay={i * 0.06}>
                <article className="group relative pl-12 lg:pl-0 lg:pt-12 cursor-default">
                  <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-bronze/35 bg-panel font-mono text-[10px] font-bold text-bronze shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:border-bronze group-hover:bg-bronze/10 group-hover:shadow-bronze/20">
                    {item.step}
                  </span>
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze mb-1 transition-colors group-hover:text-chocolate dark:group-hover:text-cream">
                    {item.date}
                  </div>
                  <h3 className="font-display text-lg font-bold text-chocolate transition-colors group-hover:text-bronze">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-charcoal/68 line-clamp-3">
                    {item.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Tech Pulse Section ---- */}
      {activeFilter === "all" && techPulseItems.length > 0 && (
        <section className="relative mt-20 w-full overflow-hidden py-16 sm:py-24">
          <div className="absolute inset-0 bg-chocolate dark:bg-[#0f0b07]" />
          <div aria-hidden className="absolute inset-0 bg-tech-glow-main" />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-[0.42fr_0.58fr] lg:gap-8">
              {/* Left Column: Intro + Bento Stats */}
              <div>
                <Reveal>
                  <div className="mb-1 flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
                      Tech Pulse
                    </span>
                    <div className="h-px w-12 bg-cream/10" />
                  </div>
                  <h2 className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight text-cream sm:text-5xl">
                    What&apos;s happening in tech
                  </h2>
                  <p className="mt-4 max-w-md text-pretty leading-7 text-cream/60">
                    Hand-picked updates from the wider tech world — with a chapter
                    point of view on why each one matters for students.
                  </p>
                </Reveal>
                
                <Reveal delay={0.1}>
                  <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-cream/10 bg-cream/10 sm:grid-cols-2 cursor-default">
                    <div className="group bg-[#1e1610] px-5 py-6 transition-colors hover:bg-[#2a1f17]">
                      <div className="font-display text-3xl font-bold text-cream transition-transform origin-left group-hover:scale-105 group-hover:text-bronze">
                        Latest
                      </div>
                      <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze">
                        August 2025
                      </div>
                    </div>
                    <div className="group bg-[#1e1610] px-5 py-6 transition-colors hover:bg-[#2a1f17]">
                      <div className="font-display text-3xl font-bold text-cream transition-transform origin-left group-hover:scale-105 group-hover:text-bronze">
                        3
                      </div>
                      <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze">
                        Curated Sources
                      </div>
                    </div>
                    <div className="group bg-[#1e1610] px-5 py-6 sm:col-span-2 transition-colors hover:bg-[#2a1f17]">
                      <div className="font-display text-3xl font-bold text-cream transition-transform origin-left group-hover:scale-105 group-hover:text-bronze">
                        ~7 min
                      </div>
                      <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-bronze">
                        Average Read Time
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>

              {/* Right Column: Cards */}
              <div className="space-y-4">
                {techPulseItems.map((item, i) => (
                  <Reveal key={item.slug} delay={i * 0.08}>
                    <div className="group/card block">
                      <MechaPanel
                        className="transition-transform duration-300 group-hover/card:-translate-y-0.5 border border-cream/10 shadow-2xl backdrop-blur relative"
                        style={
                          {
                            "--mecha-fill": "rgba(0, 0, 0, 0.6)",
                            "--mecha-line": "rgba(255, 255, 255, 0.1)",
                          } as CSSProperties
                        }
                        bodyClassName="flex items-start gap-5 p-5 sm:p-6"
                      >
                        <div aria-hidden className="absolute inset-0 bg-tech-glow-card opacity-80 pointer-events-none" />
                        
                        {/* Thumbnail */}
                        <div className="relative hidden h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg sm:block z-10">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            sizes="112px"
                            className="object-cover transition-transform duration-500 group-hover/card:scale-110"
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 z-10">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                              {item.date}
                            </span>
                          </div>
                          <h3 className="mt-2 font-display text-base font-bold text-cream transition-colors group-hover/card:text-bronze sm:text-lg">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-cream/64 line-clamp-2">
                            {item.summary}
                          </p>
                          <Link href={`/newsroom/${item.slug}`} className="group mt-3 flex w-max items-center gap-1.5 text-xs text-cream/40 font-mono transition-colors hover:text-cream">
                            Read Full Digest <span className="mecha-btn-arrow text-bronze">→</span>
                          </Link>
                        </div>
                      </MechaPanel>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Closing CTA ---- */}
      <section className="mt-20 mb-20 mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-panel shadow-xl ring-1 ring-hairline">
            <div className="relative grid gap-8 px-7 py-10 sm:px-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12 lg:py-12">
              <div>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
                  Built for the next launch
                </span>
                <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
                  Stay in the loop
                </h2>
                <p className="mt-4 max-w-2xl text-pretty leading-7 text-charcoal/70">
                  Follow the Newsroom for announcements, event recaps, member
                  spotlights, and a curated pulse on what&apos;s happening in tech.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href="/cp-arena"
                  className="group mecha-btn mecha-btn--solid"
                >
                  Enter the Arena <span className="mecha-btn-arrow text-cream/70">→</span>
                </Link>
                <Link
                  href="/team"
                  className="mecha-btn mecha-btn--ghost"
                >
                  Meet the Team
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function CalendarIcon({ className = "" }: { className?: string }) {
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
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}

function PostCard({ post, index }: { post: NewsPost; index: number }) {
  return (
    <Reveal delay={(index % 3) * 0.08} className="h-full">
      <div className="group/card block h-full">
        <MechaPanel
          ticks
          label={typeLabel(post.type)}
          index={index < 9 ? `0${index + 1}` : `${index + 1}`}
          className="h-full transition-all duration-500 group-hover/card:-translate-y-2"
          bodyClassName="flex h-full flex-col p-1.5"
        >
          {/* Post Image */}
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[6px]">
            <Image
              src={post.image}
              alt={post.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover/card:scale-105"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-chocolate/70 via-transparent to-transparent dark:from-[#0d0906]/80" />
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-chocolate/70 px-3 py-1 backdrop-blur dark:bg-[#0d0906]/70">
              <CalendarIcon className="text-cream/80" />
              <span className="font-mono text-xs text-cream">{post.date}</span>
            </div>
          </div>

          {/* Post Info */}
          <div className="flex flex-1 flex-col p-5">
            <h3 className="font-display text-xl font-bold text-chocolate transition-colors group-hover/card:text-bronze">
              {post.title}
            </h3>
            <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-wider text-bronze/80">
              {post.tagline}
            </p>
            <p className="mt-3 text-sm leading-6 text-charcoal/70 line-clamp-3 flex-1">
              {post.summary}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-hairline pt-4">
             {post.author && (
  <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal/50">
    By {post.author}
  </span>
)}
              {post.readTime && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-charcoal/50">
                  <ClockIcon />
                  {post.readTime}
                </span>
              )}
            </div>

            {/* Arrow */}
            <Link 
              href={`/newsroom/${post.slug}`} 
              className="group mt-4 flex w-max items-center gap-2 text-xs font-semibold text-bronze transition-colors hover:text-chocolate dark:hover:text-cream"
            >
              Read article
              <span className="mecha-btn-arrow">→</span>
            </Link>
          </div>
        </MechaPanel>
      </div>
    </Reveal>
  );
}
