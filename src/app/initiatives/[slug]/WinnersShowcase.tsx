"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Quote } from "lucide-react";

export default function WinnersShowcase({ winners }: { winners: Record<string, unknown>[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {winners.map((winner, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: idx * 0.1 }}
          className="relative rounded-2xl border border-[#e2e8f0] bg-white/50 p-8 shadow-sm backdrop-blur dark:border-[#3a2c20] dark:bg-[#221a12]/50 flex flex-col"
        >
          <Quote className="absolute top-6 right-6 h-8 w-8 text-bronze/20 rotate-180" />
          
          <p className="relative z-10 flex-grow text-lg italic text-chocolate/80 dark:text-cream/80 mb-8">
            &quot;{winner.quote as string}&quot;
          </p>
          
          <div className="flex items-center gap-4 mt-auto">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-bronze">
              <Image 
                src={winner.photo as string} 
                alt={winner.name as string}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h4 className="font-space font-bold text-chocolate dark:text-cream">
                {winner.name as string}
              </h4>
              <p className="text-sm font-medium text-bronze">
                {winner.achievement as string}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
