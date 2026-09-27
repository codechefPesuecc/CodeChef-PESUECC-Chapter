import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { recruitmentApplications, users } from "@/server/db/schema";
import { getRecruitmentSettings } from "@/server/recruitment";
import {
  RECRUITMENT_DOMAINS,
  DOMAIN_QUESTIONS,
  WRAP_UP_QUESTIONS,
  YEAR_OF_STUDY_OPTIONS,
  countWords,
  type RecruitmentDomain,
} from "@/lib/recruitment-schema";
import { aggregateLeaderboard } from "@/server/leaderboard";

export interface ApplicationResponseData {
  id: string;
  userId: string;
  cycle: string;
  domains: RecruitmentDomain[];
  yearOfStudy: string;
  branch: string;
  phone: string;
  heardFrom: string | null;
  responses: Record<string, any>;
  status: "submitted" | "under_review" | "shortlisted" | "rejected" | "accepted";
  reviewerNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AdminApplicationItem extends ApplicationResponseData {
  user: {
    id: string;
    username: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    prn: string;
    srn: string | null;
    phone: string | null;
    createdAt: number;
  };
  arenaStats: {
    points: number;
    rank: number | null;
    solved: number;
  };
}

export interface SubmitApplicationInput {
  domains: string[];
  yearOfStudy: string;
  branch: string;
  phone: string;
  prn?: string;
  srn?: string;
  heardFrom?: string;
  responses: Record<string, any>;
}

export type SubmitApplicationResult =
  | { ok: true; application: ApplicationResponseData }
  | { ok: false; error: string; status: number };

export async function getUserApplication(
  userId: string,
  cycle: string,
): Promise<ApplicationResponseData | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recruitmentApplications)
    .where(
      and(
        eq(recruitmentApplications.userId, userId),
        eq(recruitmentApplications.cycle, cycle),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  let parsedDomains: RecruitmentDomain[] = [];
  try {
    parsedDomains = JSON.parse(row.domains);
  } catch {
    parsedDomains = [];
  }

  let parsedResponses: Record<string, any> = {};
  try {
    parsedResponses = JSON.parse(row.responses);
  } catch {
    parsedResponses = {};
  }

  return {
    id: row.id,
    userId: row.userId,
    cycle: row.cycle,
    domains: parsedDomains,
    yearOfStudy: row.yearOfStudy,
    branch: row.branch,
    phone: row.phone,
    heardFrom: row.heardFrom,
    responses: parsedResponses,
    status: row.status as ApplicationResponseData["status"],
    reviewerNotes: row.reviewerNotes,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function submitOrUpdateApplication(
  userId: string,
  input: SubmitApplicationInput,
): Promise<SubmitApplicationResult> {
  const settings = await getRecruitmentSettings();
  if (!settings.isOpen) {
    return { ok: false, error: "Recruitment is currently closed.", status: 400 };
  }

  const cycle = settings.cycle?.trim() || "current";

  // Validate domains (must be 1 or 2 valid domains)
  if (!Array.isArray(input.domains) || input.domains.length === 0 || input.domains.length > 2) {
    return {
      ok: false,
      error: "Please select 1 or 2 domains to apply for.",
      status: 400,
    };
  }

  for (const domain of input.domains) {
    if (!RECRUITMENT_DOMAINS.includes(domain as RecruitmentDomain)) {
      return { ok: false, error: `Invalid domain selected: ${domain}`, status: 400 };
    }
  }

  const selectedDomains = input.domains as RecruitmentDomain[];

  // Validate personal info
  const yearOfStudy = String(input.yearOfStudy ?? "").trim();
  if (!YEAR_OF_STUDY_OPTIONS.includes(yearOfStudy)) {
    return { ok: false, error: "Please select a valid year of study.", status: 400 };
  }

  const branch = String(input.branch ?? "").trim();
  if (!branch || branch.length > 50) {
    return { ok: false, error: "Please enter your branch/major (up to 50 characters).", status: 400 };
  }

  const phone = String(input.phone ?? "").trim();
  if (!phone || phone.length < 10 || phone.length > 20) {
    return {
      ok: false,
      error: "Please enter a valid WhatsApp / Phone number.",
      status: 400,
    };
  }

  const heardFrom = input.heardFrom ? String(input.heardFrom).trim() : null;
  const responses = input.responses && typeof input.responses === "object" ? input.responses : {};

  // Validate domain-specific questions for each selected domain
  for (const domain of selectedDomains) {
    const questions = DOMAIN_QUESTIONS[domain];
    for (const q of questions) {
      const val = responses[q.id];
      if (q.required) {
        if (val === undefined || val === null || String(val).trim() === "") {
          return {
            ok: false,
            error: `Missing required answer for "${q.label}" in ${domain}.`,
            status: 400,
          };
        }
      }
      if (q.maxWords && typeof val === "string" && val.trim()) {
        const words = countWords(val);
        if (words > q.maxWords) {
          return {
            ok: false,
            error: `Answer for "${q.label}" exceeds maximum limit of ${q.maxWords} words (current: ${words} words).`,
            status: 400,
          };
        }
      }
    }
  }

  // Validate wrap-up questions
  for (const q of WRAP_UP_QUESTIONS) {
    const val = responses[q.id];
    if (q.required) {
      if (val === undefined || val === null || String(val).trim() === "") {
        return {
          ok: false,
          error: `Missing required answer for "${q.label}".`,
          status: 400,
        };
      }
    }
    if (q.maxWords && typeof val === "string" && val.trim()) {
      const words = countWords(val);
      if (words > q.maxWords) {
        return {
          ok: false,
          error: `Answer for "${q.label}" exceeds maximum limit of ${q.maxWords} words (current: ${words} words).`,
          status: 400,
        };
      }
    }
  }

  const db = getDb();
  const now = Date.now();

  // Check if existing application exists
  const existing = await db
    .select()
    .from(recruitmentApplications)
    .where(
      and(
        eq(recruitmentApplications.userId, userId),
        eq(recruitmentApplications.cycle, cycle),
      ),
    )
    .limit(1);

  const appId = existing[0]?.id ?? crypto.randomUUID();
  const createdAt = existing[0]?.createdAt ?? now;
  const currentStatus = existing[0]?.status ?? "submitted";

  const row = {
    id: appId,
    userId,
    cycle,
    domains: JSON.stringify(selectedDomains),
    yearOfStudy,
    branch,
    phone,
    heardFrom,
    responses: JSON.stringify(responses),
    status: currentStatus,
    updatedAt: now,
    createdAt,
  };

  await db
    .insert(recruitmentApplications)
    .values(row)
    .onConflictDoUpdate({
      target: [recruitmentApplications.userId, recruitmentApplications.cycle],
      set: {
        domains: row.domains,
        yearOfStudy: row.yearOfStudy,
        branch: row.branch,
        phone: row.phone,
        heardFrom: row.heardFrom,
        responses: row.responses,
        updatedAt: now,
      },
    });

  // Ensure user profile also has phone, prn and srn saved
  try {
    const userUpdate: Record<string, any> = { phone };
    const rawPrn = input.prn ? String(input.prn).trim().toUpperCase() : null;
    const rawSrn = input.srn ? String(input.srn).trim().toUpperCase() : null;
    if (rawPrn) {
      userUpdate.prn = rawPrn;
    }
    if (rawSrn) {
      userUpdate.srn = rawSrn;
    }
    await db
      .update(users)
      .set(userUpdate)
      .where(eq(users.id, userId));
  } catch {
    // Non-fatal
  }

  return {
    ok: true,
    application: {
      id: appId,
      userId,
      cycle,
      domains: selectedDomains,
      yearOfStudy,
      branch,
      phone,
      heardFrom,
      responses,
      status: currentStatus as ApplicationResponseData["status"],
      reviewerNotes: existing[0]?.reviewerNotes ?? null,
      reviewedBy: existing[0]?.reviewedBy ?? null,
      reviewedAt: existing[0]?.reviewedAt ?? null,
      createdAt,
      updatedAt: now,
    },
  };
}

export async function getAdminApplications(
  cycleFilter?: string,
): Promise<AdminApplicationItem[]> {
  const db = getDb();
  const settings = await getRecruitmentSettings();
  const cycle = cycleFilter || settings.cycle?.trim() || "current";

  const rows = await db
    .select({
      app: recruitmentApplications,
      user: {
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        prn: users.prn,
        srn: users.srn,
        phone: users.phone,
        createdAt: users.createdAt,
      },
    })
    .from(recruitmentApplications)
    .innerJoin(users, eq(recruitmentApplications.userId, users.id))
    .where(eq(recruitmentApplications.cycle, cycle))
    .orderBy(desc(recruitmentApplications.createdAt));

  const allLeaderboard = await aggregateLeaderboard("all");
  const leaderboardMap = new Map(
    allLeaderboard.map((item) => [item.display, item]),
  );

  return rows.map(({ app, user }) => {
    let parsedDomains: RecruitmentDomain[] = [];
    try {
      parsedDomains = JSON.parse(app.domains);
    } catch {
      parsedDomains = [];
    }

    let parsedResponses: Record<string, any> = {};
    try {
      parsedResponses = JSON.parse(app.responses);
    } catch {
      parsedResponses = {};
    }

    const boardStats = leaderboardMap.get(user.username);

    return {
      id: app.id,
      userId: app.userId,
      cycle: app.cycle,
      domains: parsedDomains,
      yearOfStudy: app.yearOfStudy,
      branch: app.branch,
      phone: app.phone,
      heardFrom: app.heardFrom,
      responses: parsedResponses,
      status: app.status as ApplicationResponseData["status"],
      reviewerNotes: app.reviewerNotes,
      reviewedBy: app.reviewedBy,
      reviewedAt: app.reviewedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      user,
      arenaStats: {
        points: boardStats?.points ?? 0,
        rank: boardStats?.rank ?? null,
        solved: boardStats?.solved ?? 0,
      },
    };
  });
}

export async function updateApplicationStatus(
  adminId: string,
  applicationId: string,
  status: string,
  reviewerNotes?: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const validStatuses = ["submitted", "under_review", "shortlisted", "rejected", "accepted"];
  if (!validStatuses.includes(status)) {
    return { ok: false, error: "Invalid status value.", status: 400 };
  }

  const db = getDb();
  const now = Date.now();

  const updatePayload: Record<string, any> = {
    status,
    reviewedBy: adminId,
    reviewedAt: now,
    updatedAt: now,
  };

  if (reviewerNotes !== undefined) {
    updatePayload.reviewerNotes = reviewerNotes;
  }

  const result = await db
    .update(recruitmentApplications)
    .set(updatePayload)
    .where(eq(recruitmentApplications.id, applicationId));

  return { ok: true };
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = Array.isArray(val) ? val.join("; ") : String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function exportApplicationsCsv(cycleFilter?: string): Promise<string> {
  const apps = await getAdminApplications(cycleFilter);

  // Headers
  const headers = [
    "Application ID",
    "Applied At (IST)",
    "Status",
    "Name",
    "Username",
    "Email",
    "WhatsApp Phone",
    "PRN",
    "SRN",
    "Year of Study",
    "Branch",
    "Selected Domains",
    "Heard From",
    "Arena Solved",
    "Arena Points",
    "Goals for Year",
    "Other Clubs",
    "Extra Links / Resume",
    "Reviewer Notes",
    "All Detailed Responses (JSON)",
  ];

  const rows: string[] = [headers.map(escapeCsvField).join(",")];

  for (const app of apps) {
    const appliedDate = new Date(app.createdAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const goals = app.responses.wrapup_goals || "";
    const otherClubs = app.responses.wrapup_other_clubs || "";
    const extraLinks = app.responses.wrapup_extra_links || "";

    const row = [
      app.id,
      appliedDate,
      app.status,
      app.user.name || "",
      app.user.username,
      app.user.email,
      app.phone,
      app.user.prn,
      app.user.srn || "",
      app.yearOfStudy,
      app.branch,
      app.domains.join(", "),
      app.heardFrom || "",
      app.arenaStats.solved,
      app.arenaStats.points,
      goals,
      otherClubs,
      extraLinks,
      app.reviewerNotes || "",
      JSON.stringify(app.responses),
    ];

    rows.push(row.map(escapeCsvField).join(","));
  }

  return rows.join("\n");
}
