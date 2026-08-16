"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Calendar, CheckCircle2 } from "lucide-react";
import Image from "next/image";


interface TimelineEvent {
  date: string;
  title: string;
  tag: string;
  description: string;
  image?: string;
  stats?: { label: string; value: string }[];
  features?: string[];
}
export default function EventTimeline({ timeline }: { timeline: TimelineEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div className="relative mx-auto max-w-6xl px-6 lg:px-8 py-12" ref={containerRef}>
      {/* Central Spine */}
      <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-[3px] bg-chocolate/10 dark:bg-cream/10 -translate-x-1/2 rounded-full" />
      
      {/* Animated progress trunk */}
      <motion.div
        className="absolute left-6 lg:left-1/2 top-0 w-[3px] bg-bronze origin-top -translate-x-1/2 z-0 rounded-full shadow-[0_0_15px_rgba(205,127,50,0.6)]"
        style={{ height: lineHeight }}
      />

      <div className="relative z-10 flex flex-col gap-16 lg:gap-24">
        {timeline.map((event, index) => {
          const isEven = index % 2 === 0;
          
          return (
            <div key={index} className="relative">
              {/* Branch Connection SVG (Desktop Only) */}
              <svg 
                className={`hidden lg:block absolute top-[28px] w-24 h-24 pointer-events-none z-0 ${
                  isEven ? "right-[50%] -scale-x-100" : "left-[50%]"
                }`}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Background trace branch */}
                <path 
                  d="M 0,0 C 50,0 50,50 100,50" 
                  fill="none" 
                  className="stroke-chocolate/10 dark:stroke-cream/10" 
                  strokeWidth="3" 
                />
                {/* Glowing fill branch that could animate if we wanted, but static looks good too */}
                <motion.path 
                  d="M 0,0 C 50,0 50,50 100,50" 
                  fill="none" 
                  className="stroke-bronze opacity-50" 
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </svg>

              <motion.div
                initial={{ opacity: 0, y: 50, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.1, type: "spring", bounce: 0.3 }}
                className={`flex flex-col lg:flex-row items-start ${
                  isEven ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Spacer for alternating layout */}
                <div className="hidden lg:block lg:w-1/2" />

                {/* Center Node (The "Acorn") */}
                <div className="absolute left-6 lg:left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-white dark:bg-[#1a140f] border-4 border-chocolate/10 dark:border-cream/10 z-20 mt-3 lg:mt-3 transition-colors duration-500 hover:border-bronze">
                  <div className="h-2.5 w-2.5 rounded-full bg-bronze animate-pulse" />
                </div>

                {/* Detailed Event Card (The "Leaves") */}
                <div
                  className={`w-full lg:w-1/2 pl-12 lg:pl-0 pt-1 lg:pt-0 ${
                    isEven ? "lg:pr-24 text-left" : "lg:pl-24 text-left"
                  }`}
                >
                  {/* Card Container */}
                  <div className="group relative rounded-3xl border border-[#e2e8f0] bg-white/60 p-1 shadow-md backdrop-blur-xl transition-all duration-300 hover:shadow-xl dark:border-[#3a2c20] dark:bg-[#1a140f]/60 hover:border-bronze/50">
                    
                    <div className="rounded-[1.3rem] overflow-hidden bg-white dark:bg-[#221a12] p-6 lg:p-8">
                      {/* Top Meta Data */}
                      <div className="flex flex-wrap items-center gap-3 mb-5">
                        <span className="inline-flex items-center rounded-full bg-bronze/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-bronze">
                          {event.tag}
                        </span>
                        <span className="flex items-center text-sm font-semibold text-chocolate/60 dark:text-cream/60">
                          <Calendar className="mr-1.5 h-4 w-4" />
                          {event.date}
                        </span>
                      </div>
                      
                      {/* Title & Description */}
                      <h3 className="font-display text-3xl font-bold text-chocolate dark:text-cream mb-4 tracking-tight">
                        {event.title}
                      </h3>
                      <p className="text-chocolate/80 dark:text-cream/70 leading-relaxed text-[15px] mb-8">
                        {event.description}
                      </p>

                      {/* Image Embed (If exists) */}
                      {event.image && (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-8 border border-chocolate/10 dark:border-cream/10 shadow-inner">
                          <Image 
                            src={event.image} 
                            alt={event.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                      )}

                      {/* Stats Grid */}
                      {event.stats && Array.isArray(event.stats) && event.stats.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 mb-8">
                          {event.stats.map((stat: {label: string, value: string}, i: number) => (
                            <div key={i} className="bg-chocolate/5 dark:bg-cream/5 rounded-xl p-4 border border-chocolate/5 dark:border-cream/5">
                              <div className="text-2xl font-bold text-chocolate dark:text-cream font-mono">{stat.value}</div>
                              <div className="text-xs font-semibold text-chocolate/60 dark:text-cream/60 uppercase tracking-wider mt-1">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Features/Highlights List */}
                      {event.features && Array.isArray(event.features) && event.features.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold text-chocolate dark:text-cream uppercase tracking-wider mb-4 border-b border-chocolate/10 dark:border-cream/10 pb-2">
                            Key Details
                          </h4>
                          {event.features.map((feature: string, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-sm text-chocolate/80 dark:text-cream/80 font-medium leading-relaxed">
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
