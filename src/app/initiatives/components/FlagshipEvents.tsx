import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { events } from "./data";
import { SectionIntro } from "./Shared";

export function FlagshipEvents() {
  return (
    <section id="flagship-events" className="relative w-full px-6 py-16 sm:py-20 lg:px-16 lg:py-24">

      {/* DECORATIVE BACKGROUND SVGS */}
      <svg className="absolute top-0 right-0 w-[400px] h-[400px] opacity-[0.12] dark:opacity-[0.12] pointer-events-none z-0 text-[#8B7A5E] dark:text-[#D98A53]" viewBox="0 0 400 400" fill="none">
        <path d="M400 50 H200 L150 100 V300" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="200" cy="50" r="3" fill="currentColor" />
        <circle cx="150" cy="100" r="3" fill="currentColor" />
        <circle cx="150" cy="300" r="3" fill="currentColor" />
        <path d="M400 80 H280 L230 130 V350" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <svg className="absolute bottom-0 left-0 w-[300px] h-[300px] opacity-[0.12] dark:opacity-[0.12] pointer-events-none z-0 text-[#8B7A5E] dark:text-[#D98A53]" viewBox="0 0 300 300" fill="none">
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

        <div className="mt-12 space-y-20 lg:space-y-28">
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
    <article className="relative w-full isolate group">
      {/* ═══════════════════════════════════════════════
       *  1. THE PIXEL-PERFECT POLYGON BORDER (User Design)
       *  Outer shape (border color) + Inner shape (fill color)
       * ═══════════════════════════════════════════════ */}
      
      {/* Drop shadow container (clip-path hides true shadows, so we use drop-shadow on a wrapper) */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-500 group-hover:drop-shadow-[0_12px_32px_rgba(40,28,16,0.2)] drop-shadow-[0_4px_12px_rgba(40,28,16,0.1)] dark:drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
      >
        {/* 1. OUTER SHAPE (The Main Border Color - 3px thick base) */}
        <div 
          style={{
            clipPath: `polygon(
              /* Mobile: Simple Chamfered Rectangle */
              0 20px, 20px 0, calc(100% - 20px) 0, 100% 20px, 
              100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0 calc(100% - 20px)
            )`
          }}
          className="absolute inset-0 bg-[#8c7b67]/60 dark:bg-[#5c4a38] lg:hidden"
        />
        <div 
          style={{
            clipPath: `polygon(
              0 20px, 
              20px 0, 
              calc(420px - 20px) 0, 
              420px 20px, 
              420px 140px, 
              405px 155px, 
              405px 325px, 
              420px 340px, 
              420px calc(480px - 20px), 
              calc(420px + 20px) 480px, 
              calc(100% - 20px) 480px, 
              100% calc(480px + 20px), 
              100% calc(100% - 20px), 
              calc(100% - 20px) 100%, 
              20px 100%, 
              0 calc(100% - 20px)
            )`
          }}
          className="absolute inset-0 bg-brown dark:bg-[#5c4a38] hidden lg:block"
        />

        {/* 2. MIDDLE SHAPE (The Clean White Line - inset by 3px. Includes thick accent bar on left) */}
        <div 
          style={{
            clipPath: `polygon(
              3px 23px, 23px 3px, calc(100% - 23px) 3px, calc(100% - 3px) 23px, 
              calc(100% - 3px) calc(100% - 23px), calc(100% - 23px) calc(100% - 3px), 23px calc(100% - 3px), 3px calc(100% - 23px)
            )`
          }}
          className="absolute inset-0 bg-white dark:bg-[#2c241c] lg:hidden opacity-80"
        />
        <div 
          style={{
            clipPath: `polygon(
              3px 23px, 
              23px 3px, 
              calc(420px - 23px) 3px, 
              417px 23px, 
              417px 137px, 
              402px 152px, 
              402px 328px, 
              417px 343px, 
              417px calc(480px - 17px), 
              calc(420px + 17px) 483px, 
              calc(100% - 23px) 483px, 
              calc(100% - 3px) calc(480px + 23px), 
              calc(100% - 3px) calc(100% - 23px), 
              calc(100% - 23px) calc(100% - 3px), 
              23px calc(100% - 3px), 
              3px calc(100% - 23px),
              3px 340px,
              13px 330px,
              13px 150px,
              3px 140px
            )`
          }}
          className="absolute inset-0 bg-white dark:bg-[#2c241c] hidden lg:block opacity-80"
        />

        {/* 3. INNER SHAPE (The Fill Color - inset by 9px total to create 6px thick white line) */}
        <div 
          style={{
            clipPath: `polygon(
              9px 29px, 29px 9px, calc(100% - 29px) 9px, calc(100% - 9px) 29px, 
              calc(100% - 9px) calc(100% - 29px), calc(100% - 29px) calc(100% - 9px), 29px calc(100% - 9px), 9px calc(100% - 29px)
            )`
          }}
          className="absolute inset-0 bg-[var(--l-shape-fill)] lg:hidden"
        />
        <div 
          style={{
            clipPath: `polygon(
              9px 29px, 
              29px 9px, 
              calc(420px - 29px) 9px, 
              411px 29px, 
              411px 131px, 
              396px 146px, 
              396px 334px, 
              411px 349px, 
              411px calc(480px - 11px), 
              calc(420px + 11px) 489px, 
              calc(100% - 29px) 489px, 
              calc(100% - 9px) calc(480px + 29px), 
              calc(100% - 9px) calc(100% - 29px), 
              calc(100% - 29px) calc(100% - 9px), 
              29px calc(100% - 9px), 
              9px calc(100% - 29px),
              9px 346px,
              19px 336px,
              19px 144px,
              9px 134px
            )`
          }}
          className="absolute inset-0 bg-[var(--l-shape-fill)] hidden lg:block"
        />
      </div>

      {/* ═══════════════════════════════════════════════
       *  2. THE STRICT CONTENT GRID
       * ═══════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-[420px_1fr] lg:grid-rows-[480px_auto]">

        {/* ─── LEFT COLUMN — spans full height ─── */}
        <div className="lg:col-start-1 lg:row-span-2 w-full h-full p-8 lg:p-12">
          <Reveal delay={index * 0.05} className="h-full">
            <div className="flex flex-col h-full">

              {/* Category pill + accent number */}
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full bg-[#D9C9AE]/40 dark:bg-[#2B231D] border border-brown/20 px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] text-brown dark:text-[#E8DFD8] uppercase">
                  {event.category}
                </span>
                <span className="font-sans text-3xl font-bold text-brown dark:text-[#A39281] opacity-30">
                  0{index + 1}
                </span>
              </div>

              {/* Title */}
              <h3 className="mt-8 font-display text-[2rem] font-bold leading-[1.1] text-[#221E1A] dark:text-[#E8DFD8] lg:text-[2.5rem]">
                {event.title}
              </h3>

              {/* Description */}
              <p className="mt-5 max-w-[38ch] font-sans text-[0.95rem] leading-[1.65] text-[#6B6255] dark:text-[#A39281]">
                {event.description}
              </p>

              {/* Highlights — "+" prefix pills */}
              <div className="mt-8 flex flex-col items-start gap-3">
                {event.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="inline-flex w-fit items-center gap-3 rounded-full bg-transparent border border-brown/30 dark:border-[#3B2F26] px-4 py-1.5 transition-colors hover:bg-brown/5"
                  >
                    <span className="font-mono text-[11px] font-bold text-brown dark:text-[#D98A53]">+</span>
                    <span className="font-sans text-[0.82rem] font-medium text-[#4a3f35] dark:text-[#E8DFD8]">
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>

              {/* Status + Cadence — pushed to bottom */}
              <div className="mt-auto pt-10 flex flex-wrap gap-2 font-mono text-[10px] tracking-[0.08em] uppercase">
                <div className="rounded-full bg-transparent border border-brown/30 dark:border-[#3B2F26] px-3 py-1.5 text-[#6B6255] dark:text-[#A39281]">
                  <span className="text-brown dark:text-[#D98A53]">STATUS:</span>{" "}
                  {event.status}
                </div>
                <div className="rounded-full bg-transparent border border-brown/30 dark:border-[#3B2F26] px-3 py-1.5 text-[#6B6255] dark:text-[#A39281]">
                  <span className="text-brown dark:text-[#D98A53]">CADENCE:</span>{" "}
                  {event.cadence}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ─── TOP-RIGHT — The chamfered image ─── */}
        <div className="lg:col-start-2 lg:row-start-1 w-full h-[320px] lg:h-full p-6 lg:p-0 lg:pl-[40px] lg:pb-[40px] lg:pr-12 lg:pt-12">
          <Reveal delay={index * 0.05 + 0.05} className="w-full h-full">
            <div 
              className="relative w-full h-full overflow-hidden shadow-xl rounded-3xl"
            >
              <Image
                src={cover.src}
                alt={`${event.title}: ${cover.caption}`}
                fill
                priority={index === 0}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Dark gradient overlay */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-[rgba(20,16,10,0.9)] via-[rgba(20,16,10,0.2)] to-transparent"
              />
              {/* Caption + subtitle */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="font-display text-xl font-bold text-white sm:text-2xl">
                  {cover.caption}
                </div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.1em] text-white/60 uppercase">
                  {event.title} visual archive
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ─── BOTTOM-RIGHT — Detailed explanation ─── */}
        <div className="lg:col-start-2 lg:row-start-2 w-full p-6 lg:p-0 lg:pl-[40px] lg:pt-8">
          <Reveal delay={index * 0.05 + 0.1}>
            <div className="flex flex-col items-start lg:pr-12 lg:pb-12">
              {/* Heading */}
              <h4 className="font-display text-[1.1rem] font-bold tracking-tight text-[#221E1A] dark:text-[#E8DFD8] uppercase tracking-[0.05em]">
                PROGRAM BRIEF
              </h4>
              {/* Body */}
              <p className="mt-4 max-w-prose font-sans text-[0.95rem] leading-[1.7] text-[#6B6255] dark:text-[#A39281]">
                {event.detailedExplanation}
              </p>

              {/* CTA Button — bordered rectangle with arrow */}
              <Link
                href={event.href}
                className="group/btn self-end mt-10 inline-flex items-center justify-center gap-3 border-[1.5px] border-[#221E1A] dark:border-[#D98A53] bg-transparent px-8 py-3.5 font-mono text-[11px] font-bold tracking-[0.15em] text-[#221E1A] dark:text-[#D98A53] uppercase transition-all duration-300 hover:bg-[#221E1A] dark:hover:bg-[#D98A53] hover:text-[#FBF6ED] dark:hover:text-[#1C1714]"
              >
                VIEW PROGRAM DETAILS
                <span className="inline-block transition-transform duration-300 ease-out group-hover/btn:translate-x-1.5 group-hover/btn:-translate-y-0.5">
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