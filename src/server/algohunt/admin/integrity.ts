import { asc, desc, eq } from "drizzle-orm";
import {
  AWAY_REASONS, type AwayReason, type DeviceKind, type EventStatus, type TeamStatus,
} from "@/lib/algohunt/types";
import { FREQUENT_AWAY_COUNT } from "@/lib/algohunt/integrity-rules";
import { getDb } from "@/server/db";
import {
  ahIntegrityEvents, ahStageProgress, ahStages, ahTeamDevices, ahTeams, type AhEvent,
} from "@/server/db/schema";

// Admin view of who played from where, and how long laptops spent away from the page.
// Everything here is a prompt for a human to look closer; nothing acts on its own.

/** Tunable alert thresholds. */
export const INTEGRITY_THRESHOLDS = {
  /** A device first seen this long after the start counts as a new device. */
  newDeviceGraceMs: 10 * 60_000,
  /** One away stretch at least this long. */
  longAwayMs: 60_000,
  /** Total away time at least this long. */
  totalAwayMs: 5 * 60_000,
  /** At least this many away stretches. */
  frequentAwayCount: FREQUENT_AWAY_COUNT,
} as const;

const MAX_EPISODES_PER_TEAM = 50;

export type IntegrityAlertKind =
  | "SHARED_DEVICE" | "PHONE" | "NEW_DEVICE_AFTER_START" | "MANY_DEVICES"
  | "TOTAL_AWAY" | "LONG_AWAY" | "FREQUENT_AWAY";

export interface IntegrityAlert {
  kind: IntegrityAlertKind;
  severity: "high" | "medium";
  message: string;
}

export interface DeviceView {
  deviceId: string;
  kind: DeviceKind;
  browser: string;
  firstIp: string | null;
  lastIp: string | null;
  loginCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Names of other teams that used this same browser. */
  sharedWith: string[];
}

export interface AwayEpisodeView {
  id: string;
  deviceId: string;
  reasons: AwayReason[];
  leftAt: number;
  returnedAt: number | null;
  /** Null while still away or when the page closed before coming back. */
  awayMs: number | null;
  /** The question the team was on when it left. */
  questionNumber: number | null;
}

export interface TeamIntegrityView {
  teamId: string;
  teamName: string;
  teamCode: string;
  status: TeamStatus;
  devices: DeviceView[];
  away: {
    count: number;
    totalMs: number;
    longestMs: number;
    unreturned: number;
    episodes: AwayEpisodeView[];
  };
  alerts: IntegrityAlert[];
}

export interface IntegrityOverview {
  generatedAt: number;
  event: { slug: string; name: string; status: EventStatus; startedAt: number | null; endsAt: number | null };
  teams: TeamIntegrityView[];
  totals: { teamsWithAlerts: number; highAlerts: number; phones: number; sharedDevices: number; awayEpisodes: number };
}

/** "Chrome on Windows". Good enough to tell devices apart at a glance; the raw string stays in the DB. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const browser =
    /Edg\//.test(ua) ? "Edge"
      : /OPR\/|Opera/.test(ua) ? "Opera"
        : /Firefox\//.test(ua) ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
            : /Safari\//.test(ua) ? "Safari"
              : "Unknown browser";
  const os =
    /iPhone/.test(ua) ? "iPhone"
      : /iPad/.test(ua) ? "iPad"
        : /Android/.test(ua) ? "Android"
          : /CrOS/.test(ua) ? "ChromeOS"
            : /Windows/.test(ua) ? "Windows"
              : /Mac OS X|Macintosh/.test(ua) ? "macOS"
                : /Linux/.test(ua) ? "Linux"
                  : null;
  return os ? `${browser} on ${os}` : browser;
}

function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 1 ? `${minutes} min` : `${Math.round(ms / 1000)} s`;
}

/** Which question was current at time t: the first one not yet completed by then. */
function questionAt(stages: { number: number; completedAt: number | null }[], t: number): number | null {
  return stages.find((stage) => stage.completedAt === null || stage.completedAt > t)?.number ?? null;
}

export function alertsFor(
  team: Pick<TeamIntegrityView, "devices" | "away">,
  event: { startedAt: number | null; maxTeamSize: number },
): IntegrityAlert[] {
  const alerts: IntegrityAlert[] = [];
  const t = INTEGRITY_THRESHOLDS;
  const shared = team.devices.filter((device) => device.sharedWith.length > 0);
  if (shared.length > 0) {
    const others = [...new Set(shared.flatMap((device) => device.sharedWith))].join(", ");
    alerts.push({ kind: "SHARED_DEVICE", severity: "high", message: `Same browser also logged in as: ${others}.` });
  }
  const phones = team.devices.filter((device) => device.kind === "MOBILE");
  if (phones.length > 0) {
    alerts.push({
      kind: "PHONE",
      severity: "high",
      message: `${phones.length === 1 ? "A phone" : `${phones.length} phones`} logged in. Teams solve and enter codes on laptops.`,
    });
  }
  if (event.startedAt !== null) {
    const late = team.devices.filter((device) => device.firstSeenAt > event.startedAt! + t.newDeviceGraceMs);
    if (late.length > 0) {
      alerts.push({
        kind: "NEW_DEVICE_AFTER_START",
        severity: "medium",
        message: `${late.length} device${late.length === 1 ? "" : "s"} first appeared after the start.`,
      });
    }
  }
  if (team.devices.length > event.maxTeamSize) {
    alerts.push({ kind: "MANY_DEVICES", severity: "medium", message: `${team.devices.length} devices for one team.` });
  }
  if (team.away.totalMs >= t.totalAwayMs) {
    alerts.push({ kind: "TOTAL_AWAY", severity: "high", message: `Away from the page for ${formatMinutes(team.away.totalMs)} in total.` });
  }
  if (team.away.longestMs >= t.longAwayMs) {
    alerts.push({ kind: "LONG_AWAY", severity: "medium", message: `Longest single stretch away: ${formatMinutes(team.away.longestMs)}.` });
  }
  if (team.away.count >= t.frequentAwayCount) {
    alerts.push({ kind: "FREQUENT_AWAY", severity: "medium", message: `Left the page ${team.away.count} times.` });
  }
  return alerts;
}

/** 5 queries for the whole event; aggregation happens here. */
export async function getIntegrityOverview(event: AhEvent, now = Date.now()): Promise<IntegrityOverview> {
  const db = getDb();
  const [teams, devices, episodes, stages, progress] = await Promise.all([
    db.select().from(ahTeams).where(eq(ahTeams.eventId, event.id)).orderBy(asc(ahTeams.teamName)),
    db.select().from(ahTeamDevices).where(eq(ahTeamDevices.eventId, event.id)).orderBy(asc(ahTeamDevices.firstSeenAt)),
    db.select().from(ahIntegrityEvents).where(eq(ahIntegrityEvents.eventId, event.id)).orderBy(desc(ahIntegrityEvents.leftAt)),
    db.select({ id: ahStages.id, number: ahStages.stageNumber }).from(ahStages)
      .where(eq(ahStages.eventId, event.id)).orderBy(asc(ahStages.stageNumber)),
    db.select({ teamId: ahStageProgress.teamId, stageId: ahStageProgress.stageId, completedAt: ahStageProgress.completedAt })
      .from(ahStageProgress).where(eq(ahStageProgress.eventId, event.id)),
  ]);

  const teamName = new Map(teams.map((team) => [team.id, team.teamName]));
  const teamsByDevice = new Map<string, Set<string>>();
  for (const device of devices) {
    const set = teamsByDevice.get(device.deviceId) ?? new Set<string>();
    set.add(device.teamId);
    teamsByDevice.set(device.deviceId, set);
  }
  const completedAt = new Map(progress.map((row) => [`${row.teamId}:${row.stageId}`, row.completedAt]));

  const views = teams.map((team): TeamIntegrityView => {
    const teamStages = stages.map((stage) => ({
      number: stage.number,
      completedAt: completedAt.get(`${team.id}:${stage.id}`) ?? null,
    }));
    const teamDevices: DeviceView[] = devices.filter((device) => device.teamId === team.id).map((device) => ({
      deviceId: device.deviceId,
      kind: device.kind as DeviceKind,
      browser: describeUserAgent(device.userAgent),
      firstIp: device.firstIp,
      lastIp: device.lastIp,
      loginCount: device.loginCount,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      sharedWith: [...(teamsByDevice.get(device.deviceId) ?? [])]
        .filter((id) => id !== team.id).map((id) => teamName.get(id) ?? id),
    }));
    const teamEpisodes = episodes.filter((episode) => episode.teamId === team.id);
    const durations = teamEpisodes.map((episode) => (episode.returnedAt === null ? null : episode.returnedAt - episode.leftAt));
    const known = durations.filter((ms): ms is number => ms !== null);
    const away = {
      count: teamEpisodes.length,
      totalMs: known.reduce((sum, ms) => sum + ms, 0),
      longestMs: known.length > 0 ? Math.max(...known) : 0,
      unreturned: durations.length - known.length,
      episodes: teamEpisodes.slice(0, MAX_EPISODES_PER_TEAM).map((episode, i) => ({
        id: episode.id,
        deviceId: episode.deviceId,
        reasons: AWAY_REASONS.filter((reason) => episode.reasons.split(",").includes(reason)),
        leftAt: episode.leftAt,
        returnedAt: episode.returnedAt,
        awayMs: durations[i],
        questionNumber: questionAt(teamStages, episode.leftAt),
      })),
    };
    const view = {
      teamId: team.id,
      teamName: team.teamName,
      teamCode: team.teamCode,
      status: team.status as TeamStatus,
      devices: teamDevices,
      away,
      alerts: [] as IntegrityAlert[],
    };
    view.alerts = alertsFor(view, { startedAt: event.startedAt, maxTeamSize: event.maxTeamSize });
    return view;
  });

  const score = (view: TeamIntegrityView) =>
    view.alerts.filter((alert) => alert.severity === "high").length * 1000 + view.alerts.length * 100;
  views.sort((a, b) => score(b) - score(a) || b.away.totalMs - a.away.totalMs || a.teamName.localeCompare(b.teamName));

  return {
    generatedAt: now,
    event: {
      slug: event.slug,
      name: event.name,
      status: event.status as EventStatus,
      startedAt: event.startedAt,
      endsAt: event.endsAt,
    },
    teams: views,
    totals: {
      teamsWithAlerts: views.filter((view) => view.alerts.length > 0).length,
      highAlerts: views.reduce((sum, view) => sum + view.alerts.filter((alert) => alert.severity === "high").length, 0),
      phones: devices.filter((device) => device.kind === "MOBILE").length,
      sharedDevices: [...teamsByDevice.values()].filter((set) => set.size > 1).length,
      awayEpisodes: episodes.length,
    },
  };
}
