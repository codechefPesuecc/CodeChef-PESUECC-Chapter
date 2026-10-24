import { z } from "zod";

/** Same wording and limits as the PR 1 flags route. */
export const reasonSchema = z.string().trim()
  .min(5, "Give a reason of at least 5 characters.")
  .max(500, "Keep the reason to 500 characters.");

/** The typed confirmation. The route compares it to the team code or event slug, exactly. */
export const confirmSchema = z.string().max(200);

export const CONFIRM_MISMATCH = "Confirmation text does not match.";
