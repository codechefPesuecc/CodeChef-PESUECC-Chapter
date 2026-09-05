"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Camera } from "lucide-react";
import type { GalleryImage } from "@/lib/initiatives";

interface Props {
  images: GalleryImage[];
  title: string;
  fallbackImage?: string;
}

export default function EventHeroGallery({ images, title, fallbackImage }: Props) {
  // Consolidate images: if gallery is empty or missing, fallback to the main hero image
  const displayImages: GalleryImage[] =
    images && images.length > 0
      ? images
      : [{ src: fallbackImage || "/dev-team.jpg", caption: title }];

  const [currentIndex, setCurrentIndex] = useState(0);

  const activeImage = displayImages[currentIndex] || displayImages[0];
  const hasMultiple = displayImages.length > 1;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="w-full mt-10">
      {/* Main Hero Viewport — Wide Cinematic 21:9 on desktop, 16:9 on mobile */}
      <div className="group relative w-full aspect-[16/9] sm:aspect-[2/1] lg:aspect-[21/9] overflow-hidden rounded-3xl border border-[#e2e8f0] bg-[#1a140f] shadow-2xl dark:border-[#3a2c20]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <Image
              src={activeImage.src}
              alt={activeImage.caption || `${title} photo ${currentIndex + 1}`}
              fill
              priority={currentIndex === 0}
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {/* Ambient Gradient Overlays */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none"
        />

        {/* Caption & Counter in Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 flex items-end justify-between gap-4 pointer-events-none">
          <div className="max-w-xl">
            {activeImage.caption && (
              <p className="font-display text-lg sm:text-2xl font-bold text-white tracking-tight drop-shadow-md">
                {activeImage.caption}
              </p>
            )}
            <p className="text-xs sm:text-sm font-mono uppercase tracking-wider text-cream/70 mt-1">
              {title} &bull; Visual Archive
            </p>
          </div>

          {hasMultiple && (
            <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 backdrop-blur-md border border-white/10 text-xs font-mono font-medium text-white/90 shadow-lg">
              <Camera className="h-3.5 w-3.5 text-bronze" />
              <span>
                {currentIndex + 1} / {displayImages.length}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Arrows (Only shown when multiple photos exist) */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/50 text-white border border-white/15 backdrop-blur-md flex items-center justify-center opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/80 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/50 text-white border border-white/15 backdrop-blur-md flex items-center justify-center opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/80 hover:scale-110 active:scale-95"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Interactive Thumbnail Strip (Shown if multiple images) */}
      {hasMultiple && (
        <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          {displayImages.map((img, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`View photo ${idx + 1}`}
                aria-current={isActive ? "true" : undefined}
                className={`group relative h-16 w-24 sm:h-20 sm:w-32 shrink-0 overflow-hidden rounded-xl border transition-all duration-300 ${
                  isActive
                    ? "border-bronze ring-2 ring-bronze/50 scale-[1.02] shadow-lg"
                    : "border-chocolate/15 dark:border-cream/15 opacity-60 hover:opacity-100 hover:scale-100"
                }`}
              >
                <Image
                  src={img.src}
                  alt={img.caption || `Thumbnail ${idx + 1}`}
                  fill
                  sizes="128px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {isActive && (
                  <div className="absolute inset-0 bg-bronze/10 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
