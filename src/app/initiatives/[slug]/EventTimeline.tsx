"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Calendar } from "lucide-react";

export default function EventTimeline({ timeline }: { timeline: Record<string, unknown>[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div className="relative mx-auto max-w-5xl px-6 lg:px-8 py-12" ref={containerRef}>
      {/* Central Spine */}
      <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-0.5 bg-chocolate/10 dark:bg-cream/10 -translate-x-1/2" />
      
      {/* Animated progress line */}
      <motion.div
        className="absolute left-6 lg:left-1/2 top-0 w-0.5 bg-bronze origin-top -translate-x-1/2 z-0"
        style={{ height: lineHeight }}
      />

      <div className="relative z-10 flex flex-col gap-12 lg:gap-24">
        {timeline.map((event, index) => {
          const isEven = index % 2 === 0;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={`flex flex-col lg:flex-row items-start ${
                isEven ? "lg:flex-row-reverse" : ""
              }`}
            >
              {/* Spacer for alternating layout on desktop */}
              <div className="hidden lg:block lg:w-1/2" />

              {/* Center Node */}
              <div className="absolute left-6 lg:left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-cream dark:bg-[#1a140f] border-2 border-bronze shadow-[0_0_10px_rgba(205,127,50,0.5)] z-20">
                <div className="h-2 w-2 rounded-full bg-bronze" />
              </div>

              {/* Event Card */}
              <div
                className={`w-full lg:w-1/2 pl-12 lg:pl-0 ${
                  isEven ? "lg:pr-16 text-left lg:text-right" : "lg:pl-16 text-left"
                }`}
              >
                <div className="group relative rounded-2xl border border-[#e2e8f0] bg-white/50 p-6 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-md dark:border-[#3a2c20] dark:bg-[#221a12]/50">
                  <div
                    className={`flex items-center gap-3 mb-4 ${
                      isEven ? "lg:justify-end" : "justify-start"
                    }`}
                  >
                    <span className="inline-flex items-center rounded-full bg-chocolate/5 px-3 py-1 text-xs font-semibold text-chocolate dark:bg-cream/5 dark:text-cream">
                      {event.tag as string}
                    </span>
                    <span className="flex items-center text-sm font-medium text-chocolate/60 dark:text-cream/60">
                      <Calendar className="mr-1.5 h-4 w-4" />
                      {event.date as string}
                    </span>
                  </div>
                  
                  <h3 className="font-space text-2xl font-bold text-chocolate dark:text-cream mb-3">
                    {event.title as string}
                  </h3>
                  
                  <p className="text-chocolate/70 dark:text-cream/70 leading-relaxed">
                    {event.description as string}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
