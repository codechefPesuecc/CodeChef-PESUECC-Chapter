"use client";

import { useEffect, useState } from "react";

/**
 * Whether the recruitment drive is currently open, from
 * /api/recruitment/status. `undefined` while loading — mirrors useUser().
 *
 * Callers should treat `undefined` as "not open yet" rather than rendering
 * optimistically: showing a Join link that vanishes a moment later is worse
 * than showing it a moment late.
 */
export function useRecruitmentOpen(): boolean | undefined {
  const [isOpen, setIsOpen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recruitment/status");
        const data = await res.json();
        if (!cancelled) setIsOpen(data?.ok === true && data.isOpen === true);
      } catch {
        // Network trouble shouldn't surface as a broken navbar — just no link.
        if (!cancelled) setIsOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isOpen;
}
