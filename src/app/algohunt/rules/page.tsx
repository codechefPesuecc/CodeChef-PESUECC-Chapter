import type { Metadata } from "next";
import Link from "@/components/AppLink";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { EVENT_FACTS, RULES } from "@/lib/algohunt/rules-content";

export const metadata: Metadata = { title: "AlgoHunt 2.0 | Rules" };

/** Public rules page (no team login): the content lives in rules-content.ts. */
export default function AlgoHuntRulesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">AlgoHunt 2.0</p>
        <h1 className="font-display text-3xl font-bold">Rules</h1>
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
      <nav className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/algohunt/faq" className="mecha-btn mecha-btn--ghost mecha-btn--sm">FAQ</Link>
        <Link href="/algohunt" className="mecha-btn mecha-btn--ghost mecha-btn--sm">Back to AlgoHunt</Link>
      </nav>
    </main>
  );
}
