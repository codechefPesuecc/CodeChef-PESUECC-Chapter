"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { TeamData } from "./lib";
import YearSelector from "./components/YearSelector";
import TeamSection from "./components/TeamSection";

interface TeamPageClientProps {
  data: TeamData;
}

export default function TeamPageClient({ data }: TeamPageClientProps) {
  const [selectedYear, setSelectedYear] = useState(data.years[0] ?? "");
  const yearData = data.byYear[selectedYear];

  // Track whether user has changed the year at least once.
  // On the very first render we skip AnimatePresence entirely
  // so there is zero motion wrapper around the SSR content.
  const [hasChangedYear, setHasChangedYear] = useState(false);
  const handleSelect = (year: string) => {
    setHasChangedYear(true);
    setSelectedYear(year);
  };

  const sections = yearData && (
    <>
      {/* FR2 — Coordinator → Core → Members order */}
      <TeamSection
        eyebrow="Leadership"
        title="Club Coordinator"
        members={yearData.coordinators}
        isCoordinator
        columns="center"
      />

      <TeamSection
        eyebrow="Engineering &amp; Operations"
        title="Core Team"
        members={yearData.core}
        columns="3"
      />

      <TeamSection
        eyebrow="The Chapter"
        title="Members"
        members={yearData.members}
        columns="4"
      />

      {/* Empty state — all three groups are empty */}
      {yearData.coordinators.length === 0 &&
        yearData.core.length === 0 &&
        yearData.members.length === 0 && (
          <div className="mt-20 text-center">
            <p className="text-charcoal/50">
              No team data available for {selectedYear}.
            </p>
          </div>
        )}
    </>
  );

  return (
    <main className="flex-1">
      {/* Hero header + year selector */}
      <section className="mx-auto max-w-6xl px-6 pt-8 sm:pt-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
              Our people
            </span>
            <h1 className="mt-2 text-balance font-display text-4xl font-bold tracking-tight text-chocolate sm:text-5xl">
              Team
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-charcoal/70">
              The people who build, compete, and run the CodeChef PESUECC
              Chapter — past and present.
            </p>
          </div>

          {/* FR4 — Year selector top-right */}
          {data.years.length > 1 && (
            <div className="shrink-0 sm:mt-1">
              <YearSelector
                years={data.years}
                selected={selectedYear}
                onSelect={handleSelect}
              />
            </div>
          )}
        </div>
      </section>

      {/* Team grid */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        {hasChangedYear ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {sections}
            </motion.div>
          </AnimatePresence>
        ) : (
          // First paint: no motion wrapper — zero hydration flicker
          <div>{sections}</div>
        )}
      </section>
    </main>
  );
}
