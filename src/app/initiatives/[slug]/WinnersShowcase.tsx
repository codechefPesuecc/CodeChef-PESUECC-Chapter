"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Quote, Trophy, Users, ExternalLink } from "lucide-react";
import type { Winner } from "@/lib/initiatives";

export default function WinnersShowcase({ winners }: { winners: Winner[] }) {
  if (!winners || winners.length === 0) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h2 className="font-space text-4xl font-bold text-chocolate dark:text-cream sm:text-5xl">
          Hall of Fame
        </h2>
        <p className="mt-4 text-lg text-chocolate/70 dark:text-cream/70">
          The champions who conquered the arena and etched their names in history.
        </p>
      </div>

      <div className="flex flex-col gap-16">
        {winners.map((winner, index) => {
          const isFirst = index === 0;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative flex flex-col ${
                isFirst ? "lg:flex-row" : "lg:flex-row-reverse items-center"
              } gap-8 lg:gap-12 rounded-3xl bg-white/50 dark:bg-[#1a140f]/50 border ${
                isFirst ? "border-bronze/50 shadow-[0_0_30px_rgba(205,127,50,0.15)]" : "border-[#e2e8f0] dark:border-[#3a2c20]"
              } p-6 lg:p-10 backdrop-blur-sm`}
            >
              {/* Grand Photo Section */}
              <div className={`relative ${isFirst ? "w-full lg:w-1/2 aspect-[4/3]" : "w-full lg:w-2/5 aspect-video"} overflow-hidden rounded-2xl border border-chocolate/10 dark:border-cream/10 bg-chocolate/5 dark:bg-cream/5 flex items-center justify-center`}>
                {winner.heroImage ? (
                  <Image
                    src={winner.heroImage}
                    alt={winner.team}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <Trophy className="h-16 w-16 text-bronze/30" />
                )}
                {isFirst && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-bronze/90 backdrop-blur text-white px-4 py-2 rounded-full font-bold shadow-lg">
                    <Trophy className="h-5 w-5" />
                    Grand Champions
                  </div>
                )}
              </div>

              {/* Grand Details Section */}
              <div className={`flex flex-col ${isFirst ? "w-full lg:w-1/2 justify-center" : "w-full lg:w-3/5"}`}>
                <div className="mb-2 inline-flex font-mono text-sm font-bold uppercase tracking-widest text-bronze">
                  {winner.achievement}
                </div>
                
                <h3 className={`font-display font-bold text-chocolate dark:text-cream mb-6 ${isFirst ? "text-4xl lg:text-5xl" : "text-3xl"}`}>
                  {winner.team}
                </h3>

                {/* Team Members List */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-sm font-bold text-chocolate/50 dark:text-cream/50 uppercase tracking-wider mb-3 border-b border-chocolate/10 dark:border-cream/10 pb-2">
                    <Users className="h-4 w-4" />
                    Team Roster
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {winner.members.map((member, i) => (
                      <a key={i} href={member.linkedin || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-chocolate/5 dark:bg-cream/5 hover:bg-chocolate/10 dark:hover:bg-cream/10 text-chocolate dark:text-cream text-sm font-semibold rounded-lg border border-chocolate/10 dark:border-cream/10 transition-colors">
                        {member.name}
                        {member.linkedin && <ExternalLink className="h-3.5 w-3.5 text-chocolate/50 dark:text-cream/50" />}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Testimonial / Experience */}
                <div className="relative mt-auto">
                  <Quote className="absolute -top-3 -left-2 h-10 w-10 text-bronze/20 -rotate-6" />
                  <p className={`relative z-10 text-chocolate/80 dark:text-cream/80 italic leading-relaxed ${isFirst ? "text-lg lg:text-xl font-medium" : "text-base"}`}>
                    &quot;{winner.experience}&quot;
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
