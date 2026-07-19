import Image from "next/image";
import Link from "next/link";

const metrics = [
  { value: "500+", label: "Active Developers" },
  { value: "3+", label: "Production Platforms Built" },
  { value: "$1000+", label: "Monthly Rewards Distributed" },
];

const pillars = [
  {
    eyebrow: "01 · Structured CP",
    title: "Daily Competitive Practice",
    body: "A daily Problem of the Day, live campus leaderboards, and monthly cash bounties that turn consistent practice into real rewards.",
  },
  {
    eyebrow: "02 · Universal Scale",
    title: "Platforms Built to Scale",
    body: "Open contests powered by our self-hosted judge and event infrastructure — engineered to scale from a single classroom to inter-college hackathons.",
  },
  {
    eyebrow: "03 · Inter-College Integration",
    title: "One Programming Community",
    body: "Flagship events like AlgoHunt and Praxis bring together problem-solvers from across campuses into a single, connected community.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative -mt-24 overflow-hidden pt-24">
        {/* Branded background image, full-bleed, fading into the cream canvas */}
        <div aria-hidden className="absolute inset-0 z-0">
          <Image
            src="/homepage.png"
            alt=""
            fill
            priority
            unoptimized
            className="object-cover object-top"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-transparent to-cream"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-20 sm:pt-14 sm:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full border border-hairline bg-panel px-3 py-1 font-mono text-xs font-medium tracking-wide text-brown">
              PES University · ECC Campus
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight text-chocolate sm:text-5xl">
              CodeChef PESUECC Chapter
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-charcoal/80">
              The official chapter of CodeChef at PES University. We run a daily
              competitive programming arena, build production platforms used by
              hundreds of students, and connect programmers across colleges — all
              engineered in the open.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/cp-arena"
                className="inline-flex items-center gap-2 rounded-lg bg-bronze px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bronze/90"
              >
                Enter the CP Arena →
              </Link>
              <Link
                href="/team"
                className="inline-flex items-center gap-2 rounded-lg border border-brown px-5 py-3 text-sm font-semibold text-brown transition-colors hover:bg-brown hover:text-white"
              >
                Meet the Team
              </Link>
            </div>
          </div>

          {/* Team photo — the chapter's development team. */}
          <div className="relative">
            <div className="rounded-2xl border border-hairline bg-panel p-2 shadow-sm">
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
                <Image
                  src="/dev-team.jpg"
                  alt="The CodeChef PESUECC Chapter development team on stage"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Live Metrics Ledger */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline shadow-sm sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-panel px-8 py-10 text-center">
              <div className="font-display text-4xl font-bold text-brown">
                {metric.value}
              </div>
              <div className="mt-2 text-sm font-medium uppercase tracking-wide text-charcoal/70">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars of Growth */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-chocolate">
            Pillars of Growth
          </h2>
          <p className="mt-3 text-charcoal/70">
            Three operational tracks that structure how our chapter learns,
            builds, and competes.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.eyebrow}
              className="rounded-2xl border border-hairline bg-panel p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
                {pillar.eyebrow}
              </span>
              <h3 className="mt-3 font-display text-xl font-bold text-chocolate">
                {pillar.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-charcoal/75">
                {pillar.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
