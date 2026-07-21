"use client";

import type { MemberInfo } from "../lib";
import MemberCard from "./MemberCard";

interface TeamSectionProps {
  /** Section heading, e.g. "Club Coordinator" */
  title: string;
  /** Eyebrow text above the title */
  eyebrow: string;
  /** Members to display */
  members: MemberInfo[];
  /** Mark cards as coordinator-sized */
  isCoordinator?: boolean;
  /** Max columns for the grid */
  columns?: "center" | "3" | "4";
}

export default function TeamSection({
  title,
  eyebrow,
  members,
  isCoordinator = false,
  columns = "4",
}: TeamSectionProps) {
  // FR7 — omit empty sections entirely.
  if (members.length === 0) return null;

  const gridClass =
    columns === "center"
      ? "flex flex-wrap justify-center gap-6"
      : columns === "3"
        ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        : "grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <section className="mt-16 first:mt-0">
      <div className="mb-8 text-center">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
          {eyebrow}
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-chocolate sm:text-3xl">
          {title}
        </h2>
      </div>

      <div className={gridClass}>
        {members.map((member, i) => (
          <MemberCard
            key={member.name}
            member={member}
            isCoordinator={isCoordinator}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
