"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Enables Lenis momentum ("smooth & premium") scrolling site-wide.
 * Uses native scroll under the hood, so window.scrollY and motion's
 * useScroll keep working. Renders nothing.
 */
export default function SmoothScroll() {
  useEffect(() => {
    // Respect the user's OS "reduce motion" preference — keep native scroll.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
