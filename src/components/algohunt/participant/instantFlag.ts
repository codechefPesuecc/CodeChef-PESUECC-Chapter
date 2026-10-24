import type { InstantFlag } from "@/lib/algohunt/types";

/**
 * Lets a component deep in the page (the code editor) ask for a flag. IntegrityGuard listens, and
 * records it only while the team is playing on a laptop, the same as every other flag.
 */
export const INSTANT_FLAG_EVENT = "ah:instant-flag";

export function requestInstantFlag(reason: InstantFlag): void {
  window.dispatchEvent(new CustomEvent<InstantFlag>(INSTANT_FLAG_EVENT, { detail: reason }));
}
