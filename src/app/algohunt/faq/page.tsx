import type { Metadata } from "next";
import Link from "@/components/AppLink";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import { FAQ } from "@/lib/algohunt/rules-content";

export const metadata: Metadata = { title: "AlgoHunt 2.0 | FAQ" };

/** Public FAQ page (no team login): the content lives in rules-content.ts. */
export default function AlgoHuntFaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">AlgoHunt 2.0</p>
        <h1 className="font-display text-3xl font-bold">Frequently asked questions</h1>
      </header>
      <MechaPanel label="FAQ" index={String(FAQ.length).padStart(2, "0")}>
        <dl className="divide-y divide-hairline p-5 sm:p-6">
          {FAQ.map((item) => (
            <div key={item.q} className="py-4 first:pt-0 last:pb-0">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-charcoal/80">{item.a}</dd>
            </div>
          ))}
        </dl>
      </MechaPanel>
      <nav className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/algohunt/rules" className="mecha-btn mecha-btn--ghost mecha-btn--sm">Rules</Link>
        <Link href="/algohunt" className="mecha-btn mecha-btn--ghost mecha-btn--sm">Back to AlgoHunt</Link>
      </nav>
    </main>
  );
}
