/**
 * Daily CP Arena — speed bounty scoring.
 *
 * Points are awarded by finish order for the Problem of the Day: the faster you
 * submit an accepted solution, the more you earn. Everyone who solves after the
 * top five still earns the base reward, so consistency is always worth points.
 */
export const SPEED_BOUNTY = [
  1000, 800, 600, 500, 400, 300, 250, 200, 150,
] as const;

/** Reward for every accepted solver who finishes 10th or later. */
export const BASE_POINTS = 100;

/** More than this many integrity flags drops a solve to the base points. */
export const FLAG_LIMIT = 5;

/** Points earned for finishing an accepted solution at a given 1-based rank. */
export function pointsForRank(rank: number): number {
  if (rank >= 1 && rank <= SPEED_BOUNTY.length) {
    return SPEED_BOUNTY[rank - 1];
  }
  return BASE_POINTS;
}

/** Ordinal label for a rank, e.g. 1 → "1st", 12 → "12th". */
export function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/** Display rows for the "how scoring works" bounty ladder. */
export const BOUNTY_LADDER: { label: string; points: number }[] = [
  ...SPEED_BOUNTY.map((points, i) => ({ label: ordinal(i + 1), points })),
  { label: `${ordinal(SPEED_BOUNTY.length + 1)}+`, points: BASE_POINTS },
];
