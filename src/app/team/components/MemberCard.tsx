"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { MemberInfo } from "../lib";
import MechaPanel from "@/components/cp-arena/MechaPanel";

/* ------------------------------------------------------------------ */
/*  Social icons                                                       */
/* ------------------------------------------------------------------ */

function LinkedInIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5A10.02 10.02 0 0 0 22 12c0-5.52-4.48-10-10-10Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  MemberCard                                                         */
/* ------------------------------------------------------------------ */

interface MemberCardProps {
  member: MemberInfo;
  /** Coordinator cards render slightly larger. */
  isCoordinator?: boolean;
  /** Stagger animation index. */
  index?: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function MemberCard({
  member,
  isCoordinator = false,
  index = 0,
}: MemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasSocials = member.linkedin || member.github || member.instagram;
  const photoSize = isCoordinator ? 128 : 104;

  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={cardVariants}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.5),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group transition-all duration-300 hover:-translate-y-1"
    >
      <MechaPanel
        ticks={true}
        bodyClassName="flex flex-col items-center p-6"
      >
        {/* Photo / Initials fallback */}
        <div
          className={`relative overflow-hidden rounded-full border-2 border-bronze/30 transition-colors group-hover:border-bronze ${isCoordinator ? "h-32 w-32" : "h-[104px] w-[104px]"
            }`}
        >
          {member.photo ? (
            <Image
              src={member.photo}
              alt={member.name}
              width={photoSize}
              height={photoSize}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bronze/15">
              <span className="font-display text-2xl font-bold text-bronze">
                {initials}
              </span>
            </div>
          )}
        </div>

        {/* Name */}
        <h3
          className={`mt-4 text-center font-display font-bold text-chocolate ${isCoordinator ? "text-lg" : "text-base"
            }`}
        >
          {member.name}
        </h3>

        {/* Role */}
        <p className="mt-1 text-center text-xs font-medium text-bronze">
          {member.role}
        </p>

        {/* Bio — visible on hover (desktop) or always visible on mobile */}
        {member.bio && (
          <p className="mt-3 line-clamp-2 text-center text-xs leading-5 text-charcoal/60 transition-colors group-hover:text-charcoal/80">
            {member.bio}
          </p>
        )}

        {/* Social links */}
        {hasSocials && (
          <div className="mt-4 flex items-center gap-3">
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${member.name} on LinkedIn`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-charcoal/50 transition-all hover:border-bronze/40 hover:text-bronze"
              >
                <LinkedInIcon />
              </a>
            )}
            {member.github && (
              <a
                href={member.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${member.name} on GitHub`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-charcoal/50 transition-all hover:border-bronze/40 hover:text-bronze"
              >
                <GitHubIcon />
              </a>
            )}
            {member.instagram && (
              <a
                href={member.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${member.name} on Instagram`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-charcoal/50 transition-all hover:border-bronze/40 hover:text-bronze"
              >
                <InstagramIcon />
              </a>
            )}
          </div>
        )}
      </MechaPanel>
    </motion.article>
  );
}
