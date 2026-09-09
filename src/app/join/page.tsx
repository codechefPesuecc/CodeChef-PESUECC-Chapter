import type { Metadata } from "next";
import Link from "@/components/AppLink";
import Reveal from "@/components/Reveal";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import GoogleFormEmbed from "@/components/join/GoogleFormEmbed";
import { getRecruitmentSettings } from "@/server/recruitment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join Us | CodeChef PESUECC",
  description:
    "Apply to join CodeChef PESUECC Chapter. Build real platforms, organize premier events, and level up together.",
};

const domains = [
  {
    name: "Competitive Programming",
    desc: "Curate challenge sets, host contests, lead algorithmic workshops, and mentor solvers in competitive programming.",
    tag: "CP",
  },
  {
    name: "Technical",
    desc: "Build and maintain chapter platforms, web applications, edge APIs, and internal tools with modern full-stack technologies.",
    tag: "TECH",
  },
  {
    name: "Design",
    desc: "Craft user interfaces, branding assets, event posters, illustrations, and visual identities across web and digital media.",
    tag: "DESIGN",
  },
  {
    name: "Events",
    desc: "Plan, organize, and execute flagship hackathons, coding contests, speaker sessions, bootcamps, and on-campus operations.",
    tag: "EVENTS",
  },
  {
    name: "Sponsorship",
    desc: "Pitch to corporate sponsors, foster industry partnerships, secure event funding, and expand external outreach.",
    tag: "SPONSOR",
  },
  {
    name: "Social Media & Marketing",
    desc: "Drive club publicity, manage social channels, craft engaging campaign copy, and amplify chapter initiatives across campus.",
    tag: "MARKETING",
  },
];

// Deliberately three steps, not four. Everything after submission is handled
// from the response sheet — no shortlist-then-task pipeline has been decided, so
// the page shouldn't describe one. Promising applicants a round that may not
// happen is worse than saying less.
const timeline = [
  {
    step: "01",
    title: "Apply",
    desc: "Fill in the form above and pick the one domain you want to be considered for.",
  },
  {
    step: "02",
    title: "We read it",
    desc: "Every response is read by the team — there's no filter you have to get past first.",
  },
  {
    step: "03",
    title: "We get in touch",
    desc: "If you're shortlisted we'll email you about what comes next. Check your spam folder too.",
  },
];

export default async function JoinPage() {
  const settings = await getRecruitmentSettings();
  const isOpen = settings.canEmbed;
  const cycle = settings.cycle?.trim();
  const cycleBadge = cycle ? `Recruitment ${cycle}` : "Recruitment";

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative -mt-24 overflow-hidden pt-24 pb-16 sm:pb-20">
        {/* Soft bronze ambient glow */}
        <div
          aria-hidden
          className="absolute -left-24 top-10 z-0 h-96 w-96 rounded-full bg-bronze/15 blur-3xl"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-10 sm:pt-16">
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-hairline bg-panel/80 px-3 py-1 font-mono text-xs font-medium tracking-wide text-brown backdrop-blur">
                {isOpen ? `${cycleBadge} · Open` : cycleBadge}
              </span>
              {isOpen && settings.closesOn && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-charcoal/70 dark:text-cream/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Closes on {settings.closesOn}
                </span>
              )}
            </div>

            <h1 className="mt-5 text-balance font-display text-4xl font-bold tracking-tight text-chocolate sm:text-5xl lg:text-6xl">
              {isOpen ? "Join CodeChef PESUECC" : "Recruitment Closed"}
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-charcoal/80">
              {isOpen
                ? "We build production platforms used daily by hundreds of students, author algorithmic problems in the open, and host flagship campus hackathons. Come help us shape what comes next."
                : `Applications${cycle ? ` for the ${cycle} cycle` : ""} are currently closed. We hold recruitment drives periodically. Explore our domains below and stay tuned for the next drive.`}
            </p>
          </Reveal>

          {/* Eligibility info bar */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Reveal delay={0.08}>
              <MechaPanel bodyClassName="p-5">
                <span className="font-mono text-xs text-bronze uppercase tracking-wider">Who can apply</span>
                <p className="mt-2 text-sm font-medium text-chocolate">All years & branches welcome</p>
                <p className="mt-1 text-xs text-charcoal/70">Curiosity, consistency, and a builder mindset matter most.</p>
              </MechaPanel>
            </Reveal>

            <Reveal delay={0.16}>
              <MechaPanel bodyClassName="p-5">
                <span className="font-mono text-xs text-bronze uppercase tracking-wider">What we build</span>
                <p className="mt-2 text-sm font-medium text-chocolate">Production software & events</p>
                <p className="mt-1 text-xs text-charcoal/70">From our Rust-powered online judge to campus-wide hackathons.</p>
              </MechaPanel>
            </Reveal>

            <Reveal delay={0.24}>
              <MechaPanel bodyClassName="p-5">
                <span className="font-mono text-xs text-bronze uppercase tracking-wider">No prerequisites</span>
                <p className="mt-2 text-sm font-medium text-chocolate">Learn on the job</p>
                <p className="mt-1 text-xs text-charcoal/70">You don’t need to be an expert. Seniors will mentor you end-to-end.</p>
              </MechaPanel>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Application Form or Closed Banner */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        {isOpen && settings.formUrl ? (
          <div className="space-y-8">
            {/* Prerequisite Callout */}
            <Reveal>
              <MechaPanel
                label="Step 0"
                index="Arena Account"
                bodyClassName="p-6 bg-bronze/5 border-bronze/20"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-chocolate">
                      Have you registered on the CP Arena?
                    </h3>
                    <p className="mt-1 text-sm text-charcoal/75">
                      The application form asks for your CodeChef PESUECC Arena username so we can link your submission to your profile.
                    </p>
                  </div>
                  <Link
                    href="/register"
                    className="mecha-btn mecha-btn--ghost shrink-0 text-xs self-start sm:self-auto"
                  >
                    Register account &rarr;
                  </Link>
                </div>
              </MechaPanel>
            </Reveal>

            {/* Google Form Embed */}
            <Reveal delay={0.1}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-bold text-chocolate">
                    Application Form
                  </h2>
                  {cycle && (
                    <span className="font-mono text-xs text-bronze uppercase tracking-wider">
                      {cycle} Drive
                    </span>
                  )}
                </div>

                <GoogleFormEmbed formUrl={settings.formUrl} />
              </div>
            </Reveal>
          </div>
        ) : (
          /* Closed Notice */
          <Reveal>
            <MechaPanel
              label="Notice"
              index="Drive Status"
              bodyClassName="p-8 sm:p-10 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bronze/10 text-bronze">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h2 className="mt-4 font-display text-2xl font-bold text-chocolate">
                Applications are not being accepted
              </h2>

              <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-charcoal/70">
                The application form is not accepting responses right now{cycle ? ` for the ${cycle} cycle` : ""}. Follow our announcements or practice on the platform to stay prepared for upcoming opportunities.
              </p>

              <div className="mt-6 flex justify-center gap-4">
                <a
                  href="https://www.instagram.com/codechef_pesuecc/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mecha-btn mecha-btn--solid inline-flex items-center gap-2 text-xs"
                >
                  Follow on Instagram &rarr;
                </a>
                <Link href="/cp-arena" className="mecha-btn mecha-btn--ghost text-xs">
                  Practice in the Arena
                </Link>
              </div>
            </MechaPanel>
          </Reveal>
        )}
      </section>

      {/* Domains Section */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
            Teams & Domains
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            Where you can contribute
          </h2>
          <p className="mt-3 text-pretty text-charcoal/70">
            Choose the domain that best aligns with your interests and where you want to make an impact.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain, i) => (
            <Reveal key={domain.name} delay={i * 0.05} className="h-full">
              <MechaPanel
                label={domain.tag}
                className="h-full transition-transform duration-200 hover:-translate-y-1"
                bodyClassName="p-6 flex flex-col justify-between h-full"
              >
                <div>
                  <h3 className="font-display text-lg font-bold text-chocolate">
                    {domain.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-charcoal/70">
                    {domain.desc}
                  </p>
                </div>
              </MechaPanel>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Recruitment Timeline / What happens next */}
      <section className="border-t border-hairline bg-panel/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-2xl">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
              Timeline
            </span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
              What happens next
            </h2>
            <p className="mt-3 text-pretty text-charcoal/70">
              Short and simple — and we read everything that comes in.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {timeline.map((item, i) => (
              <Reveal key={item.step} delay={i * 0.08} className="h-full">
                <MechaPanel
                  label={`Step ${item.step}`}
                  className="h-full"
                  bodyClassName="p-6"
                >
                  <h3 className="font-display text-base font-bold text-chocolate">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-charcoal/70">
                    {item.desc}
                  </p>
                </MechaPanel>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
