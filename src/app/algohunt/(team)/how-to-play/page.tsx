import type { Metadata } from "next";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { EVENT_FACTS, FAQ, RULES } from "@/lib/algohunt/rules-content";

export const metadata: Metadata = { title: "AlgoHunt 2.0 | Rules" };

/**
 * The rules and FAQ inside the team shell, so a team reading them still sees banners and stays in
 * full screen. /algohunt/rules and /algohunt/faq are the same content for anyone without a login.
 */
export default function AlgoHuntHowToPlayPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">Rules</h1>
        <p className="text-sm text-charcoal/70">
          {EVENT_FACTS.date} · {EVENT_FACTS.time} · {EVENT_FACTS.venue}
        </p>
      </header>
      <MechaPanel label="RULES" index={String(RULES.length).padStart(2, "0")}>
        <ol className="space-y-5 p-5 sm:p-6">
          {RULES.map((rule, i) => (
            <li key={rule.title} className="flex gap-3">
              <span className="font-mono text-sm font-semibold text-bronze">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="font-semibold">{rule.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/80">{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </MechaPanel>
      <MechaPanel label="FAQ" index={String(FAQ.length).padStart(2, "0")}>
        <dl className="space-y-4 p-5 sm:p-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-charcoal/80">{item.a}</dd>
            </div>
          ))}
        </dl>
      </MechaPanel>
    </div>
  );
}
