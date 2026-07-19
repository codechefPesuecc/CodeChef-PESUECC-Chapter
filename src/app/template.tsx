"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

/**
 * Wraps each page and re-mounts on navigation, giving a subtle fade/slide-in
 * page transition. Kept as a flex column so page `main` fills the viewport.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
