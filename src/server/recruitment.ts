import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { recruitmentSettings } from "@/server/db/schema";
import { isGoogleFormUrl } from "@/lib/recruitment";

/**
 * Recruitment drive settings — which Google Form /join embeds, and whether it is
 * showing at all.
 *
 * Applications are handled entirely in Google Forms; this module owns only the
 * pointer to that form. It lives in the database rather than in code so opening a
 * new cycle is a paste in /admin/recruitment instead of a redeploy — a committee
 * with no developer on call can still run a drive.
 *
 * Exactly one row, keyed by SETTINGS_ID. Reads never fail on a missing row (a
 * freshly migrated production database has none), and writes upsert.
 *
 * Mirrors src/server/profile.ts: a discriminated result instead of throwing, so
 * the route handler can map straight onto a status code.
 */

/** Primary key of the single settings row. */
export const SETTINGS_ID = "current";

const MAX_URL_LEN = 500;
const MAX_CYCLE_LEN = 40;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RecruitmentState {
  isOpen: boolean;
  formUrl: string | null;
  cycle: string | null;
  closesOn: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
  /**
   * Whether /join should render the form. Bundled here so the page has a single
   * thing to check and the URL is re-validated on the way out as well as in —
   * a row could predate a change to what counts as a valid form URL.
   */
  canEmbed: boolean;
}

/** The drive's settings, or a closed default when no row exists yet. */
export async function getRecruitmentSettings(): Promise<RecruitmentState> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recruitmentSettings)
    .where(eq(recruitmentSettings.id, SETTINGS_ID))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      isOpen: false,
      formUrl: null,
      cycle: null,
      closesOn: null,
      updatedAt: null,
      updatedBy: null,
      canEmbed: false,
    };
  }

  return {
    isOpen: row.isOpen,
    formUrl: row.formUrl,
    cycle: row.cycle,
    closesOn: row.closesOn,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    canEmbed: row.isOpen && !!row.formUrl && isGoogleFormUrl(row.formUrl),
  };
}

export type UpdateRecruitmentResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export interface RecruitmentInput {
  isOpen?: unknown;
  formUrl?: unknown;
  cycle?: unknown;
  closesOn?: unknown;
}

/**
 * Applies the fields that were actually sent, so a partial PATCH works — the
 * admin panel can save just the toggle without resubmitting the URL. Unsent
 * fields keep their stored value.
 *
 * An empty string clears `formUrl` / `cycle` / `closesOn` back to null, matching
 * how updateProfile treats a cleared SRN.
 */
export async function updateRecruitmentSettings(
  adminId: string,
  input: RecruitmentInput,
): Promise<UpdateRecruitmentResult> {
  const patch: {
    isOpen?: boolean;
    formUrl?: string | null;
    cycle?: string | null;
    closesOn?: string | null;
  } = {};

  if (input.isOpen !== undefined) {
    if (typeof input.isOpen !== "boolean") {
      return { ok: false, status: 400, error: "Open must be true or false." };
    }
    patch.isOpen = input.isOpen;
  }

  if (input.formUrl !== undefined) {
    const raw = String(input.formUrl).trim();
    if (!raw) {
      patch.formUrl = null;
    } else if (raw.length > MAX_URL_LEN) {
      return { ok: false, status: 400, error: "That form URL is too long." };
    } else if (!isGoogleFormUrl(raw)) {
      return {
        ok: false,
        status: 400,
        error:
          "Enter a Google Forms link — it should start with https://docs.google.com/forms/.",
      };
    } else {
      patch.formUrl = raw;
    }
  }

  if (input.cycle !== undefined) {
    const raw = String(input.cycle).trim();
    if (raw.length > MAX_CYCLE_LEN) {
      return { ok: false, status: 400, error: "That cycle label is too long." };
    }
    patch.cycle = raw || null;
  }

  if (input.closesOn !== undefined) {
    const raw = String(input.closesOn).trim();
    if (!raw) {
      patch.closesOn = null;
    } else if (!DATE_RE.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
      return { ok: false, status: 400, error: "Closing date must be YYYY-MM-DD." };
    } else {
      patch.closesOn = raw;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, error: "Nothing to update." };
  }

  // Merge over the stored row so a partial patch keeps the fields it didn't send,
  // and so the guard below sees the values that will actually be live.
  const current = await getRecruitmentSettings();
  const next = {
    isOpen: patch.isOpen ?? current.isOpen,
    formUrl: patch.formUrl !== undefined ? patch.formUrl : current.formUrl,
    cycle: patch.cycle !== undefined ? patch.cycle : current.cycle,
    closesOn: patch.closesOn !== undefined ? patch.closesOn : current.closesOn,
  };

  // Opening the drive with nowhere to apply would publish a /join page whose
  // whole purpose is missing. Refuse rather than ship an empty frame.
  if (next.isOpen && !next.formUrl) {
    return {
      ok: false,
      status: 400,
      error: "Add the Google Form link before opening recruitment.",
    };
  }

  const db = getDb();
  const row = {
    id: SETTINGS_ID,
    ...next,
    updatedAt: Date.now(),
    updatedBy: adminId,
  };

  await db.insert(recruitmentSettings).values(row).onConflictDoUpdate({
    target: recruitmentSettings.id,
    set: row,
  });

  return { ok: true };
}
