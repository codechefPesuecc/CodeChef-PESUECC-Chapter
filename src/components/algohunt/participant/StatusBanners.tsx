"use client";

import { Ban, Flag, Hourglass, PauseCircle, UserCheck, WifiOff, type LucideIcon } from "lucide-react";
import { COPY } from "@/lib/algohunt/copy";
import { formatIST } from "@/lib/algohunt/format";
import { useParticipantState } from "./ParticipantStateProvider";

interface Banner {
  id: string;
  icon: LucideIcon;
  text: string;
  tone: "red" | "amber" | "neutral";
}

const TONES = {
  red: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  neutral: "border-hairline bg-panel text-charcoal",
};

/** Status banners under the header, highest priority first (brief §7.1). */
export default function StatusBanners() {
  const { state, online, lastUpdated } = useParticipantState();
  const { event, team } = state;
  const banners: Banner[] = [];
  if (!online) {
    banners.push({
      id: "offline", icon: WifiOff, tone: "amber",
      text: `You're offline. Showing status from ${formatIST(lastUpdated ?? state.serverNow)}. Reconnecting…`,
    });
  }
  if (event.status === "PAUSED") banners.push({ id: "paused", icon: PauseCircle, tone: "red", text: COPY.paused });
  if (team.status === "DISQUALIFIED") banners.push({ id: "dq", icon: Ban, tone: "red", text: COPY.disqualified });
  if (event.status === "ENDED" || event.status === "ARCHIVED") {
    banners.push({ id: "ended", icon: Flag, tone: "neutral", text: COPY.ended });
  }
  if (["DRAFT", "CHECK_IN", "READY"].includes(event.status)) {
    banners.push({ id: "not-started", icon: Hourglass, tone: "neutral", text: COPY.notStarted });
  }
  if (team.status === "REGISTERED") {
    banners.push({ id: "not-checked-in", icon: UserCheck, tone: "neutral", text: COPY.notCheckedIn });
  }
  if (banners.length === 0) return null;

  return (
    <div className="space-y-2" aria-live="polite">
      {banners.map(({ id, icon: Icon, text, tone }) => (
        <p key={id} role="status" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${TONES[tone]}`}>
          <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{text}</span>
        </p>
      ))}
    </div>
  );
}
