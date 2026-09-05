"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "@/components/AppLink";
import { LinkIcon } from "lucide-react";
import type { Mentor } from "@/lib/initiatives";

export default function TeamShowcase({ team }: { team: Mentor[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {team.map((member, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: idx * 0.1 }}
          className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-chocolate/5 dark:border-[#3a2c20] dark:bg-cream/5"
        >
          {member.photo && (
            <Image
              src={member.photo}
              alt={member.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-all duration-500 group-hover:scale-105 grayscale group-hover:grayscale-0"
            />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          
          <div className="absolute bottom-0 left-0 right-0 translate-y-full p-6 transition-transform duration-300 group-hover:translate-y-0">
            <h4 className="font-space text-xl font-bold text-white mb-1">
              {member.name}
            </h4>
            <p className="text-sm font-medium text-cream/80 mb-4">
              {member.role}
            </p>
            {member.linkedin && (
              <Link 
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/40 transition-colors"
              >
                <LinkIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
