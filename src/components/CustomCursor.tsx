"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export default function CustomCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Mouse position values
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Spring physics for the liquid trailing effect
  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Hide native cursor globally when this mounts
    document.documentElement.style.cursor = "none";
    const addCursorNone = () => {
      document.body.style.cursor = "none";
      // Iterate over elements that might have their own cursor styles
      const interactiveElements = document.querySelectorAll(
        "a, button, input, textarea, select, [role='button'], label"
      );
      interactiveElements.forEach((el) => {
        (el as HTMLElement).style.cursor = "none";
      });
    };

    // We do this to ensure even hover states lose the native cursor
    addCursorNone();
    const observer = new MutationObserver(addCursorNone);
    observer.observe(document.body, { childList: true, subtree: true });

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
      observer.disconnect();
      document.documentElement.style.cursor = "auto";
      document.body.style.cursor = "auto";
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
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-8 w-8 rounded-full border border-white/40 bg-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-md"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: targetScale,
        backgroundColor: isHovering ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
      }}
      transition={{ duration: 0.2 }}
    />
  );
}
