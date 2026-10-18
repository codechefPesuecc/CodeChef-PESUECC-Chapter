import { formatIST } from "@/lib/algohunt/format";
import type { AuditAction, SubmissionStatus } from "@/lib/algohunt/types";

export type ActivityKind = "submission" | "code" | "progress" | "admin" | "system";

/** Contract §11 shape. The caller parses metadata and joins teamName / actorName from teamId / actorId. */
export interface ActivityRow {
  action: string;
  metadata: Record<string, unknown>;
  teamName?: string | null;
  actorName?: string | null;
  targetType?: string | null;
}

export interface SubmissionActivityRow {
  status: SubmissionStatus | string;
  verdict: string | null;
  failedOn: number | null;
  stageNumber: number | null;
  teamName?: string | null;
}

interface Ctx {
  meta: Record<string, unknown>;
  team: string;
  actor: string;
}

// Reads only the §9.1 metadata keys. Nothing here may echo a code value, a typed code, a password or
// source code: codes appear by serial only, and team.login_failed's teamCode is never repeated.
const DESCRIBERS: { [A in AuditAction]: (c: Ctx) => string } = {
  "team.login": (c) => `${c.team} logged in`,
  "team.login_failed": (c) => `Failed login attempt for ${c.team}`,
  "team.logout": (c) => `${c.team} logged out`,
  "team.session_takeover": (c) =>
    `⚠ ${c.team} logged in on another ${deviceWord(c.meta.toKind)}; the ${deviceWord(c.meta.fromKind)} they were using was signed out`,
  "team.checked_in": (c) => (c.meta.bulk ? `${c.team} checked in (bulk check-in)` : `${c.team} checked in`),
  "team.password_reset": (c) => `${c.actor} reset the password for ${c.team}`,
  "submission.judged": (c) => `${c.team} got ${str(c.meta.verdict) ?? "a verdict"}`,
  "stage.solved": (c) => `${c.team} solved ${question(c.meta.stageNumber)}`,
  "stage.completed": (c) => {
    if (c.meta.via === "CODE" && num(c.meta.codeSerial) !== null) {
      return `${c.team} completed ${question(c.meta.stageNumber)} with code ${serial(c.meta.codeSerial)}`;
    }
    if (c.meta.via === "OVERRIDE") return `${c.team} completed ${question(c.meta.stageNumber)} by admin override`;
    return `${c.team} completed ${question(c.meta.stageNumber)}`;
  },
  "team.finished": (c) => `${c.team} finished the hunt`,
  "code.redeemed": (c) => `${c.team} unlocked ${nextQuestion(c.meta.stageNumber)} with code ${serial(c.meta.codeSerial)}`,
  "code.attempt_suspicious": (c) => `⚠ ${c.team} entered ${num(c.meta.invalidIn10m) ?? 5} invalid codes in 10 minutes`,
  "code.batch_created": (c) => {
    const range = num(c.meta.serialFrom) !== null && num(c.meta.serialTo) !== null
      ? `, ${serial(c.meta.serialFrom)}–${serial(c.meta.serialTo)}`
      : "";
    return `${c.actor} generated batch ${quoted(c.meta.name)} (${num(c.meta.size) ?? "?"} codes${range})`;
  },
  "code.disabled": (c) => `${c.actor} disabled code ${serial(c.meta.serial)}${because(c.meta.reason)}`,
  "code.enabled": (c) => `${c.actor} re-enabled code ${serial(c.meta.serial)}${because(c.meta.reason)}`,
  "code.batch_disabled": (c) =>
    `${c.actor} disabled batch ${quoted(c.meta.batchName)} (${num(c.meta.count) ?? "?"} active codes)${because(c.meta.reason)}`,
  "code.note_updated": (c) => `${c.actor} updated the note on code ${serial(c.meta.serial)}`,
  "override.complete_stage": (c) =>
    c.meta.isFinal === true
      ? `${c.actor} completed the final question (${question(c.meta.stageNumber)}) for ${c.team} by override${because(c.meta.reason)}`
      : `${c.actor} unlocked ${nextQuestion(c.meta.stageNumber)} for ${c.team} without a code${because(c.meta.reason)}`,
  "override.revert_stage": (c) => `${c.actor} reverted ${question(c.meta.stageNumber)} for ${c.team}${because(c.meta.reason)}`,
  "team.disqualified": (c) => `${c.actor} disqualified ${c.team}${because(c.meta.reason)}`,
  "team.reinstated": (c) => `${c.actor} reinstated ${c.team}${because(c.meta.reason)}`,
  "event.created": (c) =>
    `${c.meta.isTest ? "Test event" : "Event"}${str(c.meta.slug) ? ` '${str(c.meta.slug)}'` : ""} created by ${c.actor}`,
  "event.transition": (c) => `${transitionPhrase(str(c.meta.from), str(c.meta.to))} by ${c.actor}`,
  "event.flags_changed": (c) => `${c.actor} ${flagsPhrase(c.meta.changes)}${because(c.meta.reason)}`,
  "event.end_time_changed": (c) => {
    const to = num(c.meta.to);
    if (to === null) return `${c.actor} removed the scheduled end${because(c.meta.reason)}`;
    const verb = num(c.meta.from) === null ? "set the end time to" : "moved the end time to";
    return `${c.actor} ${verb} ${formatIST(to)} IST${because(c.meta.reason)}`;
  },
  "stage.toggled": (c) =>
    `${c.actor} ${c.meta.enabled === false ? "disabled" : "enabled"} ${question(c.meta.stageNumber)}${because(c.meta.reason)}`,
  "announcement.created": (c) => {
    const priority = str(c.meta.priority);
    return `${c.actor} posted ${priority ? `a ${priority.toLowerCase()}` : "an"} announcement`;
  },
  "announcement.deactivated": (c) => `${c.actor} took down an announcement`,
  "volunteer.assigned": (c) => `${c.actor} added volunteer${handle(c.meta.username)}`,
  "volunteer.removed": (c) => `${c.actor} removed volunteer${handle(c.meta.username)}`,
  "import.challenge": (c) => `${c.actor} ${c.meta.replaced ? "replaced" : "imported"} challenge ${quoted(c.meta.slug)}`,
  "import.stages": (c) => `${c.actor} imported questions${countSuffix(c.meta.count)}`,
  "import.teams": (c) => `${c.actor} imported teams${countSuffix(c.meta.count)}`,
  "challenge.verified": (c) =>
    c.meta.verified === false
      ? `Challenge ${quoted(c.meta.slug)} failed verification (run by ${c.actor})`
      : `${c.actor} verified challenge ${quoted(c.meta.slug)}`,
  "export.downloaded": (c) => `${c.actor} downloaded ${str(c.meta.type) ? `the ${str(c.meta.type)} export` : "an export"}`,
};

const KINDS: { [A in AuditAction]: ActivityKind } = {
  "team.login": "system", "team.login_failed": "system", "team.logout": "system", "team.session_takeover": "system",
  "team.checked_in": "admin", "team.password_reset": "admin",
  "submission.judged": "submission",
  "stage.solved": "progress", "stage.completed": "progress", "team.finished": "progress",
  "code.redeemed": "code", "code.attempt_suspicious": "code",
  "code.batch_created": "admin", "code.disabled": "admin", "code.enabled": "admin",
  "code.batch_disabled": "admin", "code.note_updated": "admin",
  "override.complete_stage": "admin", "override.revert_stage": "admin",
  "team.disqualified": "admin", "team.reinstated": "admin",
  "event.created": "admin", "event.transition": "admin", "event.flags_changed": "admin",
  "event.end_time_changed": "admin", "stage.toggled": "admin",
  "announcement.created": "admin", "announcement.deactivated": "admin",
  "volunteer.assigned": "admin", "volunteer.removed": "admin",
  "import.challenge": "admin", "import.stages": "admin", "import.teams": "admin",
  "challenge.verified": "admin", "export.downloaded": "admin",
};

/** One human sentence for an audit row (contract §11). Pure. Unknown actions → "<action> (<targetType>)". */
export function describeActivity(row: {
  action: string;
  metadata: Record<string, unknown>;
  teamName?: string | null;
  actorName?: string | null;
  targetType?: string | null;
}): string {
  const describe = DESCRIBERS[row.action as AuditAction];
  if (!describe) return `${row.action} (${row.targetType ?? "unknown"})`;
  return describe({
    meta: row.metadata ?? {},
    team: row.teamName?.trim() || "A team",
    actor: row.actorName?.trim() || "An admin",
  });
}

/** The same for a judged submission: verdict, question and failing test, never source. */
export function describeSubmission(row: SubmissionActivityRow): string {
  const team = row.teamName?.trim() || "A team";
  const q = question(row.stageNumber);
  if (row.status === "FAILED") return `Judge error on a submission by ${team} for ${q}`;
  if (row.status !== "DONE" || !row.verdict) return `${team} submitted ${q} (judging)`;
  const test = row.verdict !== "AC" && row.failedOn !== null ? ` (test ${row.failedOn})` : "";
  return `${team} got ${row.verdict} on ${q}${test}`;
}

/** `ah_audit_logs.metadata` is JSON text; a bad row reads as `{}` instead of breaking the feed. */
export function parseAuditMetadata(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Feed / timeline bucket for an audit action. */
export function activityKind(action: string): ActivityKind {
  return KINDS[action as AuditAction] ?? "system";
}

const TRANSITIONS: Record<string, string> = {
  CHECK_IN: "Check-in opened",
  READY: "Event marked ready",
  ENDED: "Event ended",
  ARCHIVED: "Event archived",
  PAUSED: "Event paused",
  DRAFT: "Event moved back to draft",
};

function transitionPhrase(from: string | null, to: string | null): string {
  if (to === "LIVE") return from === "PAUSED" ? "Event resumed" : "Event started";
  return (to && TRANSITIONS[to]) ?? `Event moved to ${to ?? "an unknown status"}`;
}

const FLAG_LABELS: Record<string, string> = {
  submissionsEnabled: "submissions",
  codesEnabled: "code redemption",
  leaderboardVisible: "the team leaderboard",
};

function flagsPhrase(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "changed the event switches";
  const parts = Object.entries(changes as Record<string, unknown>)
    .filter(([key, value]) => key in FLAG_LABELS && typeof value === "boolean")
    .map(([key, value]) => `turned ${value ? "on" : "off"} ${FLAG_LABELS[key]}`);
  return parts.length > 0 ? parts.join(" and ") : "changed the event switches";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function deviceWord(kind: unknown): string {
  return kind === "MOBILE" ? "phone" : kind === "DESKTOP" ? "laptop" : "device";
}

function question(stageNumber: unknown): string {
  const n = num(stageNumber);
  return n === null ? "a question" : `Question ${n}`;
}

function nextQuestion(stageNumber: unknown): string {
  const n = num(stageNumber);
  return n === null ? "the next question" : `Question ${n + 1}`;
}

function serial(value: unknown): string {
  const n = num(value);
  return n === null ? "#?" : `#${String(n).padStart(3, "0")}`;
}

function quoted(value: unknown): string {
  return `'${str(value) ?? "unnamed"}'`;
}

function handle(username: unknown): string {
  const name = str(username);
  return name ? ` @${name}` : "";
}

function because(reason: unknown): string {
  const text = str(reason);
  return text ? `: '${text}'` : "";
}

function countSuffix(count: unknown): string {
  const n = num(count);
  return n === null ? "" : ` (${n})`;
}
