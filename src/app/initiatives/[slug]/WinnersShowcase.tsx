"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Quote, Trophy, Users, ExternalLink, Medal, Award, Sparkles } from "lucide-react";
import type { Winner } from "@/lib/initiatives";

export default function WinnersShowcase({ winners = [] }: { winners?: Winner[] }) {
  // Extract unique tracks - called unconditionally before any early returns
  const tracks = useMemo(() => {
    const list: string[] = [];
    (winners || []).forEach((w) => {
      const t = w.track?.trim();
      if (t && !list.includes(t)) {
        list.push(t);
      }
    });
    return list;
  }, [winners]);

  const hasMultipleTracks = tracks.length > 1;
  const [selectedTrack, setSelectedTrack] = useState<string>("");

  // Determine active track safely
  const activeTrack = hasMultipleTracks && tracks.includes(selectedTrack) ? selectedTrack : tracks[0] || "";

  const activeWinners = useMemo(() => {
    const list = winners || [];
    if (!hasMultipleTracks) return list;
    return list.filter((w) => w.track?.trim() === activeTrack);
  }, [winners, hasMultipleTracks, activeTrack]);

  // Early return only after all hooks have executed
  if (!winners || winners.length === 0) return null;

  const champion = activeWinners[0];
  const runnersUp = activeWinners.slice(1);
  const activePanelId = `panel-${activeTrack.toLowerCase().replace(/\s+/g, "-") || "all"}`;
  const activeTabId = `tab-${activeTrack.toLowerCase().replace(/\s+/g, "-") || "all"}`;

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-bronze/10 border border-bronze/40 text-bronze text-xs font-mono font-bold uppercase tracking-widest mb-4 shadow-[0_0_20px_rgba(166,124,82,0.25)] dark:shadow-[0_0_25px_rgba(189,138,74,0.3)]">
          <Sparkles className="h-3.5 w-3.5" />
          Hall of Fame
        </div>
        <h2 className="font-space text-4xl font-bold text-chocolate dark:text-cream sm:text-5xl">
          Podium of Champions
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-chocolate/70 dark:text-cream/70">
          The brilliant minds who conquered the arena and etched their names in history.
        </p>
      </div>

      {/* EVIDENTLY VISIBLE TRACK SWITCHER TABS WITH SUBTLE GLOW */}
      {hasMultipleTracks && (
        <div className="flex flex-col items-center mb-14">
          <div className="text-xs font-mono uppercase tracking-widest font-bold text-chocolate/60 dark:text-cream/60 mb-3 flex items-center gap-1.5">
            <span>Select Competition Track</span>
          </div>

          <div
            role="tablist"
            aria-label="Competition Tracks"
            className="inline-flex p-1.5 rounded-2xl bg-panel/90 border border-bronze/40 shadow-[0_0_25px_rgba(166,124,82,0.12)] dark:shadow-[0_0_30px_rgba(189,138,74,0.16)] ring-1 ring-bronze/20 backdrop-blur-xl gap-2"
          >
            {tracks.map((track) => {
              const isCurrent = track === activeTrack;
              const trackCount = winners.filter((w) => w.track?.trim() === track).length;
              const tabId = `tab-${track.toLowerCase().replace(/\s+/g, "-")}`;
              const panelId = `panel-${track.toLowerCase().replace(/\s+/g, "-")}`;

              return (
                <button
                  key={track}
                  role="tab"
                  id={tabId}
                  aria-selected={isCurrent}
                  aria-controls={panelId}
                  tabIndex={isCurrent ? 0 : -1}
                  onClick={() => setSelectedTrack(track)}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-space text-sm md:text-base font-bold transition-all duration-300 cursor-pointer ${
                    isCurrent
                      ? "bg-gradient-to-r from-bronze to-amber-600 text-white border border-bronze/80 shadow-[0_0_18px_rgba(166,124,82,0.35)] dark:shadow-[0_0_22px_rgba(189,138,74,0.4)] scale-[1.02]"
                      : "text-chocolate/80 dark:text-cream/80 border border-chocolate/15 dark:border-cream/15 hover:border-bronze/60 hover:text-chocolate dark:hover:text-cream hover:bg-bronze/10 hover:shadow-[0_0_16px_rgba(166,124,82,0.22)] dark:hover:shadow-[0_0_20px_rgba(189,138,74,0.28)]"
                  }`}
                >
                  <Trophy className={`h-4 w-4 ${isCurrent ? "text-white" : "text-bronze"}`} />
                  <span>{track}</span>
                  <span
                    className={`ml-1 text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                      isCurrent
                        ? "bg-white/25 text-white"
                        : "bg-chocolate/10 dark:bg-cream/10 text-chocolate/70 dark:text-cream/70"
                    }`}
                  >
                    {trackCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PODIUM SHOWCASE WITH SMOOTH ANIMATION */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTrack || "all"}
          role="tabpanel"
          id={activePanelId}
          aria-labelledby={hasMultipleTracks ? activeTabId : undefined}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-12"
        >
          {/* 🏆 1ST PLACE GRAND CHAMPION SPOTLIGHT (SUBTLE GLOW + HOVER BLOOM) */}
          {champion && (
            <div className="group relative flex flex-col lg:flex-row gap-8 lg:gap-12 rounded-3xl bg-panel/90 border-2 border-bronze/50 hover:border-bronze shadow-[0_0_25px_rgba(166,124,82,0.16)] hover:shadow-[0_0_45px_rgba(166,124,82,0.28)] dark:shadow-[0_0_28px_rgba(189,138,74,0.22)] dark:hover:shadow-[0_0_48px_rgba(189,138,74,0.36)] ring-1 ring-inset ring-bronze/20 hover:ring-bronze/40 p-6 lg:p-10 backdrop-blur-xl transition-all duration-500">
              {/* Photo Section */}
              <div className="relative w-full lg:w-1/2 aspect-[4/3] overflow-hidden rounded-2xl border border-bronze/30 shadow-[0_0_15px_rgba(166,124,82,0.1)] group-hover:shadow-[0_0_22px_rgba(166,124,82,0.2)] bg-chocolate/5 dark:bg-cream/5 flex items-center justify-center transition-all duration-500">
                {champion.heroImage ? (
                  <Image
                    src={champion.heroImage}
                    alt={champion.team}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <Trophy className="h-16 w-16 text-bronze/30" />
                )}

                {/* Champion Corner Badge with subtle glow */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-gradient-to-r from-bronze to-amber-600 text-white px-3.5 py-1.5 rounded-full font-bold shadow-[0_0_12px_rgba(166,124,82,0.4)] dark:shadow-[0_0_15px_rgba(189,138,74,0.45)] border border-white/25 text-xs sm:text-sm tracking-wide">
                  <Trophy className="h-4 w-4" />
                  {champion.badge || (hasMultipleTracks ? `${activeTrack} Champion` : "Grand Champions")}
                </div>
              </div>

              {/* Champion Details Section */}
              <div className="flex flex-col w-full lg:w-1/2 justify-center">
                {/* Track Pill */}
                {champion.track && (
                  <div className="mb-2 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-bronze">
                    <span className="h-1.5 w-1.5 rounded-full bg-bronze animate-pulse shadow-[0_0_6px_rgba(166,124,82,0.6)]" />
                    {champion.track}
                  </div>
                )}

                <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-sm font-bold uppercase tracking-widest text-bronze">
                  <Medal className="h-4 w-4 text-amber-500" />
                  {champion.achievement}
                </div>

                <h3 className="font-display text-4xl lg:text-5xl font-bold text-chocolate dark:text-cream mb-6">
                  {champion.team}
                </h3>

                {/* Team Roster */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-chocolate/50 dark:text-cream/50 uppercase tracking-wider mb-3 border-b border-chocolate/10 dark:border-cream/10 pb-2 font-mono">
                    <Users className="h-3.5 w-3.5" />
                    Winning Roster
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {champion.members?.map((member, i) =>
                      member.linkedin ? (
                        <a
                          key={i}
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-chocolate/5 dark:bg-cream/5 hover:bg-bronze/15 text-chocolate dark:text-cream text-sm font-semibold rounded-lg border border-chocolate/10 dark:border-cream/10 hover:border-bronze/40 hover:shadow-[0_0_10px_rgba(166,124,82,0.2)] transition-all"
                        >
                          {member.name}
                          <ExternalLink className="h-3.5 w-3.5 text-chocolate/50 dark:text-cream/50" />
                        </a>
                      ) : (
                        <span
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-chocolate/5 dark:bg-cream/5 text-chocolate dark:text-cream text-sm font-semibold rounded-lg border border-chocolate/10 dark:border-cream/10"
                        >
                          {member.name}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Testimonial / Experience */}
                {champion.experience && (
                  <div className="relative mt-auto pt-2">
                    <Quote className="absolute -top-2 -left-2 h-8 w-8 text-bronze/20 -rotate-6" />
                    <p className="relative z-10 text-chocolate/85 dark:text-cream/85 italic leading-relaxed text-base lg:text-lg font-medium">
                      &quot;{champion.experience}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🥈🥉 RUNNERS-UP PODIUM GRID (SUBTLE GLOW + HOVER BLOOM) */}
          {runnersUp.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-bronze/30 to-transparent" />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-bronze flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-bronze/30 bg-bronze/5 shadow-[0_0_12px_rgba(166,124,82,0.12)]">
                  <Award className="h-3.5 w-3.5 text-bronze" />
                  Podium Finishers
                </span>
                <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-bronze/30 to-transparent" />
              </div>

              <div className={`grid grid-cols-1 ${runnersUp.length > 1 ? "md:grid-cols-2" : ""} gap-6 lg:gap-8`}>
                {runnersUp.map((runner, idx) => {
                  const placeNumber = idx + 2;
                  const isSilver = placeNumber === 2;
                  const medalColor = isSilver ? "text-zinc-300 dark:text-zinc-200" : "text-amber-500";

                  return (
                    <motion.div
                      key={runner.team + idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      className="group relative flex flex-col rounded-2xl bg-panel/90 border border-bronze/35 hover:border-bronze/70 shadow-[0_0_18px_rgba(166,124,82,0.1)] hover:shadow-[0_0_35px_rgba(166,124,82,0.25)] dark:shadow-[0_0_22px_rgba(189,138,74,0.14)] dark:hover:shadow-[0_0_40px_rgba(189,138,74,0.3)] ring-1 ring-inset ring-bronze/15 hover:ring-bronze/30 p-6 backdrop-blur-xl transition-all duration-300"
                    >
                      {/* Photo Section */}
                      <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-bronze/25 group-hover:border-bronze/50 shadow-[0_0_12px_rgba(166,124,82,0.1)] group-hover:shadow-[0_0_18px_rgba(166,124,82,0.2)] bg-chocolate/5 dark:bg-cream/5 flex items-center justify-center mb-5 transition-all duration-300">
                        {runner.heroImage ? (
                          <Image
                            src={runner.heroImage}
                            alt={runner.team}
                            fill
                            sizes="(min-width: 768px) 50vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <Trophy className="h-12 w-12 text-bronze/30" />
                        )}

                        {/* Place Badge with subtle glow */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-chocolate/90 dark:bg-panel/95 text-white border border-bronze/40 shadow-[0_0_10px_rgba(166,124,82,0.3)] dark:shadow-[0_0_12px_rgba(189,138,74,0.35)] backdrop-blur px-3 py-1 rounded-full font-bold text-xs">
                          <Medal className={`h-3.5 w-3.5 ${medalColor}`} />
                          <span>{runner.badge || runner.achievement}</span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex flex-col flex-1">
                        <div className="mb-1 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-bronze">
                          <Medal className={`h-3.5 w-3.5 ${medalColor}`} />
                          {runner.achievement}
                        </div>

                        <h4 className="font-display text-2xl font-bold text-chocolate dark:text-cream mb-4">
                          {runner.team}
                        </h4>

                        {/* Team Members */}
                        <div className="mb-5">
                          <div className="flex flex-wrap gap-1.5">
                            {runner.members?.map((member, i) =>
                              member.linkedin ? (
                                <a
                                  key={i}
                                  href={member.linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2.5 py-1 bg-chocolate/5 dark:bg-cream/5 hover:bg-bronze/15 text-chocolate dark:text-cream text-xs font-medium rounded-md border border-chocolate/10 dark:border-cream/10 hover:border-bronze/40 transition-colors"
                                >
                                  {member.name}
                                  <ExternalLink className="h-3 w-3 text-chocolate/40 dark:text-cream/40" />
                                </a>
                              ) : (
                                <span
                                  key={i}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-chocolate/5 dark:bg-cream/5 text-chocolate dark:text-cream text-xs font-medium rounded-md border border-chocolate/10 dark:border-cream/10"
                                >
                                  {member.name}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {/* Experience Quote */}
                        {runner.experience && (
                          <div className="relative mt-auto pt-3 border-t border-chocolate/5 dark:border-cream/5">
                            <p className="text-chocolate/80 dark:text-cream/80 italic text-sm leading-relaxed">
                              &quot;{runner.experience}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
