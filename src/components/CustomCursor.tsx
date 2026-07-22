"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue } from "motion/react";

export default function CustomCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Mouse position values
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  useEffect(() => {
    // Explicitly reset the cursor to auto in case Fast Refresh left it as 'none'
    document.documentElement.style.cursor = "auto";
    document.body.style.cursor = "auto";
    
    const moveMouse = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16); // offset by half the width (32px / 2)
      cursorY.set(e.clientY - 16);
      if (!isVisible) setIsVisible(true);

      // Check if we are hovering over a clickable element
      const target = e.target as HTMLElement;
      if (
        target &&
        target.closest &&
        target.closest("a, button, [role='button'], input, textarea, select, label")
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", moveMouse);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", moveMouse);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [cursorX, cursorY, isVisible]);

  // Don't render anything if we're on a touch device
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return null;
  }

  // Determine target scale
  let targetScale = 0.8;
  if (isVisible) {
    targetScale = isHovering ? 1.6 : 1;
  }

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-8 w-8 rounded-full border border-black/80 dark:border-white shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
      style={{
        x: cursorX,
        y: cursorY,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: targetScale,
        backgroundColor: "transparent",
      }}
      transition={{ duration: 0.2 }}
    />
  );
}
