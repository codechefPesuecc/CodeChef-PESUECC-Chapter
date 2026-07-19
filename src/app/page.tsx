import Image from "next/image";
import Link from "next/link";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";

const metrics = [
  { prefix: "", value: 50, suffix: "+", label: "Active Developers" },
  { prefix: "", value: 3, suffix: "+", label: "Production Platforms Built" },
  { prefix: "Rs ", value: 1500, suffix: "+", label: "Monthly CP Arena Rewards" },
];

const pillars = [
  {
    icon: <BoltIcon />,
    eyebrow: "01 · Structured CP",
    title: "Daily Competitive Practice",
    body: "A daily Problem of the Day, live campus leaderboards, and monthly cash bounties that turn consistent practice into real rewards.",
  },
  {
    icon: <LayersIcon />,
    eyebrow: "02 · Universal Scale",
    title: "Platforms Built to Scale",
    body: "Open contests powered by our self-hosted judge and event infrastructure — engineered to scale from a single classroom to inter-college hackathons.",
  },
  {
    icon: <UsersIcon />,
    eyebrow: "03 · Inter-College Integration",
    title: "One Programming Community",
    body: "Flagship events like AlgoHunt and Praxis bring together problem-solvers from across campuses into a single, connected community.",
  },
];

const benefits = [
  {
    icon: <MentorIcon />,
    title: "Structured Mentorship",
    body: "Weekly guidance from seniors and problem setters who've been exactly where you're headed.",
  },
  {
    icon: <TrophyIcon />,
    title: "Monthly Cash Bounties",
    body: "Top solvers on the CP Arena leaderboard earn real cash rewards every single month.",
  },
  {
    icon: <RocketIcon />,
    title: "Real Production Projects",
    body: "Build and ship platforms used by hundreds of students — not throwaway tutorials.",
  },
  {
    icon: <GlobeIcon />,
    title: "Inter-College Network",
    body: "Compete and connect with programmers across campuses through our open events.",
  },
];

// Sample testimonials — replace the quotes and names with real member voices.
const testimonials = [
  {
    quote:
      "The daily Problem of the Day turned practice into a habit, and the leaderboard keeps it competitive. I landed my first internship this year.",
    name: "Rahul K.",
    role: "3rd-year CSE",
    initials: "RK",
  },
  {
    quote:
      "I came for the bounties and stayed for the mentorship. I went from fearing DP to setting problems myself.",
    name: "Sneha M.",
    role: "2nd-year ECE",
    initials: "SM",
  },
  {
    quote:
      "Building Eclipse with the core team taught me more about shipping real software than any course did.",
    name: "Arjun P.",
    role: "Core Developer",
    initials: "AP",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative -mt-24 overflow-hidden pt-24">
        {/* Soft bronze glow for depth */}
        <div
          aria-hidden
          className="absolute -left-24 top-10 z-0 h-96 w-96 rounded-full bg-bronze/20 blur-3xl"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-32 sm:pt-14 sm:pb-40">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <span className="inline-flex items-center rounded-full border border-hairline bg-panel/80 px-3 py-1 font-mono text-xs font-medium tracking-wide text-brown backdrop-blur">
                PES University · ECC Campus
              </span>
              <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight text-chocolate sm:text-6xl">
                CodeChef <span className="text-bronze">PESUECC</span> Chapter
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-charcoal/80">
                The official chapter of CodeChef at PES University. We run a daily
                competitive programming arena, build production platforms used by
                hundreds of students, and connect programmers across colleges — all
                engineered in the open.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/cp-arena"
                  className="group inline-flex items-center gap-2 rounded-lg bg-bronze px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-bronze/90 hover:shadow-md"
                >
                  Enter the CP Arena
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
                <Link
                  href="/team"
                  className="inline-flex items-center gap-2 rounded-lg border border-brown px-5 py-3 text-sm font-semibold text-brown transition-colors hover:bg-brown hover:text-white dark:hover:text-[#16110c]"
                >
                  Meet the Team
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="rounded-2xl border border-hairline bg-panel p-2 shadow-xl">
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
                  <Image
                    src="/dev-team.jpg"
                    alt="The CodeChef PESUECC Chapter development team on stage"
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-chocolate/60 via-transparent to-transparent dark:from-[#0d0906]/70"
                  />
                  <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-chocolate/70 px-3 py-1 backdrop-blur dark:bg-[#0d0906]/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
                    <span className="font-mono text-xs text-cream">The Dev Team</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Live Metrics Ledger — floats over the hero's lower edge */}
      <section className="relative z-20 mx-auto -mt-20 max-w-6xl px-6 sm:-mt-24">
        <Reveal>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline shadow-xl sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-panel px-8 py-10 text-center">
                <CountUp
                  value={metric.value}
                  prefix={metric.prefix}
                  suffix={metric.suffix}
                  className="font-display text-4xl font-bold text-brown"
                />
                <div className="mt-2 text-sm font-medium uppercase tracking-wide text-charcoal/70">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Pillars of Growth */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
            What we do
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            Pillars of Growth
          </h2>
          <p className="mt-3 text-pretty text-charcoal/70">
            Three operational tracks that structure how our chapter learns, builds,
            and competes.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.eyebrow} delay={i * 0.1} className="h-full">
              <article className="group h-full rounded-2xl border border-hairline bg-panel p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-bronze/40 hover:shadow-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bronze/10 text-bronze transition-colors group-hover:bg-bronze group-hover:text-white">
                  {pillar.icon}
                </div>
                <span className="mt-6 block font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
                  {pillar.eyebrow}
                </span>
                <h3 className="mt-2 font-display text-xl font-bold text-chocolate">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-charcoal/75">
                  {pillar.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-6xl px-6 pb-12 sm:pb-16">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
            Why join us
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            What you get as a member
          </h2>
          <p className="mt-3 text-pretty text-charcoal/70">
            More than a club — a system built to make you a sharper engineer.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, i) => (
            <Reveal key={benefit.title} delay={i * 0.08} className="h-full">
              <div className="h-full rounded-2xl border border-hairline bg-panel p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-bronze/40 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-bronze/10 text-bronze">
                  {benefit.icon}
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-chocolate">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-charcoal/70">
                  {benefit.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Member voices */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
            Member voices
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            What our members say
          </h2>
          <p className="mt-3 text-pretty text-charcoal/70">
            Real growth, in their words.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <Reveal key={testimonial.name} delay={i * 0.1} className="h-full">
              <figure className="flex h-full flex-col rounded-2xl border border-hairline bg-panel p-8 shadow-sm">
                <span
                  aria-hidden
                  className="font-display text-5xl leading-none text-bronze/30"
                >
                  &ldquo;
                </span>
                <blockquote className="mt-2 flex-1 text-pretty leading-7 text-charcoal/80">
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bronze/15 font-display text-sm font-bold text-bronze">
                    {testimonial.initials}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-chocolate">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-charcoal/60">{testimonial.role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-chocolate px-8 py-16 text-center shadow-xl sm:px-16 dark:bg-[#1e1610] dark:ring-1 dark:ring-hairline">
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-bronze/25 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-brown/40 blur-3xl"
            />
            <div className="relative">
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
                Ready to compete?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-cream/70">
                Solve the daily Problem of the Day, climb the campus leaderboard, and
                earn your share of the monthly bounty.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/cp-arena"
                  className="group inline-flex items-center gap-2 rounded-lg bg-bronze px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_-2px_rgba(166,124,82,0.6)] transition-all hover:bg-bronze/90"
                >
                  Enter the CP Arena
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
                <Link
                  href="/initiatives"
                  className="inline-flex items-center gap-2 rounded-lg border border-cream/25 px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-cream/10"
                >
                  Explore Initiatives
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

/* --- Pillar icons --- */

function BoltIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/* --- Benefit icons --- */

function MentorIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.42 10.42 12 15 2.58 10.42 12 5.83l9.42 4.59Z" />
      <path d="M22 10.5V15" />
      <path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h2a2 2 0 0 1 2 2 3 3 0 0 1-3 3" />
      <path d="M7 5H5a2 2 0 0 0-2 2 3 3 0 0 0 3 3" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
