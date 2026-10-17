"use client";

import { useCallback, useState } from "react";
import type { ContentReport } from "@/server/algohunt/import/content";
import OrderEditor from "./OrderEditor";
import QuestionsImport from "./QuestionsImport";
import RosterImport from "./RosterImport";

const TABS = [
  { id: "questions", label: "Questions" },
  { id: "order", label: "Question order" },
  { id: "teams", label: "Teams" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** /admin/algohunt/import: questions, their order and the team roster for one event (M6 brief §7.2). */
export default function ImportAdmin({ event, initialReport }: {
  event: { slug: string; status: string; maxTeamSize: number };
  initialReport: ContentReport;
}) {
  const [tab, setTab] = useState<Tab>("questions");
  const [report, setReport] = useState(initialReport);
  const contentEditable = ["DRAFT", "CHECK_IN", "READY"].includes(event.status);
  const teamsEditable = event.status !== "ENDED" && event.status !== "ARCHIVED";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/algohunt/content?event=${encodeURIComponent(event.slug)}`, { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; report?: ContentReport };
      if (data.ok && data.report) setReport(data.report);
    } catch {
      // The next action refreshes again.
    }
  }, [event.slug]);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Import" className="flex flex-wrap gap-1 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? "border-bronze text-chocolate" : "border-transparent text-charcoal/60 hover:text-chocolate"
            }`}
          >
            {t.label}
            {t.id === "questions" && ` (${report.challenges.length})`}
            {t.id === "order" && ` (${report.stages.length})`}
            {t.id === "teams" && ` (${report.teams.total})`}
          </button>
        ))}
      </div>

      {tab === "questions" && <QuestionsImport eventSlug={event.slug} editable={contentEditable} onChanged={refresh} />}
      {tab === "order" && (
        <OrderEditor
          // Remount only when the set of imported questions changes, so a save keeps its notice.
          key={report.challenges.map((c) => c.slug).join("|")}
          eventSlug={event.slug}
          report={report}
          editable={contentEditable}
          onSaved={refresh}
        />
      )}
      {tab === "teams" && (
        <RosterImport eventSlug={event.slug} maxTeamSize={event.maxTeamSize} editable={teamsEditable} onImported={refresh} />
      )}
    </div>
  );
}
