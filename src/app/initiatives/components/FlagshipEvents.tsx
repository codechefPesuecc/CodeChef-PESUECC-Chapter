import React from "react";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { events } from "./data";
import { SectionIntro } from "./Shared";

export function FlagshipEvents() {
  return (
    <section id="flagship-events" className="relative w-full px-6 py-16 sm:py-20 lg:p-16">
      
      {/* DECORATIVE BACKGROUND SVGS */}
      <svg className="absolute top-0 right-0 w-[400px] h-[400px] opacity-[0.15] dark:opacity-[0.15] pointer-events-none z-0 text-[#8B7A5E] dark:text-[#D98A53]" viewBox="0 0 400 400" fill="none">
        <path d="M400 50 H200 L150 100 V300" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="200" cy="50" r="3" fill="currentColor" />
        <circle cx="150" cy="100" r="3" fill="currentColor" />
        <circle cx="150" cy="300" r="3" fill="currentColor" />
        <path d="M400 80 H280 L230 130 V350" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      
      <svg className="absolute bottom-0 left-0 w-[300px] h-[300px] opacity-[0.15] dark:opacity-[0.15] pointer-events-none z-0 text-[#8B7A5E] dark:text-[#D98A53]" viewBox="0 0 300 300" fill="none">
        <circle cx="50" cy="250" r="100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="50" cy="250" r="150" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="50" cy="250" r="200" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="30" cy="270" r="12" fill="currentColor" />
      </svg>

      {/* CONTENT */}
      <div className="relative z-10 mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Flagship events"
          title="Every initiative, one blueprint"
          body="Each event ships as a single unified blueprint card — a full-height brief on the left, a floating photo in the cutout, and the detailed explanation tucked into the extension below it."
        />

        <div className="mt-12 space-y-16 lg:space-y-24">
          {events.map((event, i) => (
            <EventBlueprintCard key={event.id} event={event} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function EventBlueprintCard({
  event,
  index,
}: {
  event: (typeof events)[number];
  index: number;
}) {
  const cover = event.gallery[0];

  return (
    <article className="relative w-full isolate">
      
      {/* 1. THE PURE CHAMFERED L-SHAPE BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none drop-shadow-md dark:drop-shadow-none">
        <div className="absolute inset-0 bg-white dark:bg-[#3B2F26] hud-l-outer" />
        <div className="absolute inset-[2px] bg-[#FBF6ED] dark:bg-[#1C1714] hud-l-base" />
      </div>

      {/* 2. THE STRICT GRID */}
      <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-[380px_1fr] lg:grid-rows-[420px_auto]">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-start-1 lg:row-span-2 w-full h-full p-6 lg:p-10">
          <Reveal delay={index * 0.05} className="h-full">
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full bg-[#D9C9AE] dark:bg-[#2B231D] px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] text-[#221E1A] dark:text-[#E8DFD8] uppercase">
                  {event.category}
                </span>
                <span className="font-sans text-3xl font-bold text-[#6B6255] dark:text-[#A39281] opacity-25 dark:opacity-30">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-8 font-sans text-[2rem] font-bold leading-tight text-[#221E1A] dark:text-[#E8DFD8] lg:text-[2.5rem]">
                {event.title}
              </h3>

              <p className="mt-5 max-w-[40ch] font-sans text-[1rem] leading-[1.6] text-[#6B6255] dark:text-[#A39281]">
                {event.description}
              </p>

              <div className="mt-8 flex flex-col items-start gap-3">
                {event.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="inline-flex w-fit items-center gap-2.5 rounded-full bg-transparent border border-[#C4B59D] dark:border-[#3B2F26] px-4 py-1.5"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9C9AE] dark:bg-[#D98A53]" />
                    <span className="font-sans text-[0.82rem] font-medium text-[#6B6255] dark:text-[#E8DFD8]">
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-10 flex flex-wrap gap-2 font-mono text-[10px] tracking-[0.08em] uppercase">
                <div className="rounded-full bg-transparent border border-[#C4B59D] dark:border-[#3B2F26] px-3 py-1 text-[#6B6255] dark:text-[#A39281]">
                  <span className="text-[#D9C9AE] dark:text-[#D98A53]">STATUS:</span> {event.status}
                </div>
                <div className="rounded-full bg-transparent border border-[#C4B59D] dark:border-[#3B2F26] px-3 py-1 text-[#6B6255] dark:text-[#A39281]">
                  <span className="text-[#D9C9AE] dark:text-[#D98A53]">CADENCE:</span> {event.cadence}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* THE IMAGE */}
        <div className="lg:col-start-2 lg:row-start-1 w-full h-[320px] lg:h-full p-6 lg:p-0 lg:pl-[44px] lg:pb-[44px] lg:pr-10 lg:pt-10">
          <Reveal delay={index * 0.05 + 0.05} className="w-full h-full">
            <div className="relative w-full h-full chamfer-image overflow-hidden shadow-lg border border-white/60 dark:border-[#3B2F26]/60">
              <Image
                src={cover.src}
                alt={`${event.title}: ${cover.caption}`}
                fill
                priority={index === 0}
                sizes="(min-width: 1024px) 500px, 100vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-[rgba(20,16,10,0.85)] via-[rgba(20,16,10,0.2)] to-transparent"
              />
              <div className="absolute top-5 left-5 rounded-full bg-[rgba(20,16,10,0.6)] border border-[rgba(255,255,255,0.15)] px-3 py-1 font-mono text-[10px] font-semibold tracking-wider text-white backdrop-blur-sm">
                01 / {String(event.gallery.length).padStart(2, "0")}
              </div>
              <div className="absolute bottom-5 left-5 right-5">
                <div className="font-sans text-xl font-bold text-white sm:text-2xl">
                  {cover.caption}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.1em] text-white/70 uppercase">
                  {event.title} VISUAL ARCHIVE
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* DETAILED EXPLANATION */}
        <div className="lg:col-start-2 lg:row-start-2 w-full h-full p-6 lg:p-0 lg:pl-[44px] lg:pt-[36px]">
          <Reveal delay={index * 0.05 + 0.1}>
            <div className="flex flex-col items-start lg:pr-12 lg:pb-12">
              <h4 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[#8B7A5E] dark:text-[#A39281] uppercase">
                overview & details
              </h4>
              <p className="mt-4 max-w-prose font-sans text-[1rem] leading-[1.6] text-[#6B6255] dark:text-[#A39281]">
                {event.detailedExplanation}
              </p>
              
              {/* CTA Button with 1:30 o'clock diagonal arrow rotation on hover */}
              <Link
                href={event.href}
                className="group mt-6 inline-flex items-center justify-center gap-2 border-[1.5px] border-[#221E1A] dark:border-[#D98A53] bg-transparent px-8 py-3 font-mono text-xs font-bold tracking-[0.1em] text-[#221E1A] dark:text-[#D98A53] uppercase transition-all duration-150 hover:bg-[#221E1A] dark:hover:bg-[#D98A53] hover:text-[#FBF6ED] dark:hover:text-[#1C1714]"
              >
                KNOWMORE BUTTON HERE
                <span className="inline-block transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:rotate-[-45deg]">
                  →
                </span>
              </Link>
            </div>
          </Reveal>
        </div>

      </div>
    </article>
  );
}