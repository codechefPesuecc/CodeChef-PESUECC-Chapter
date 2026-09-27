import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "@/components/AppLink";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import MechaPanel from "@/components/cp-arena/MechaPanel";
import NativeRecruitmentForm from "@/components/join/NativeRecruitmentForm";
import { getRecruitmentSettings } from "@/server/recruitment";
import { getCurrentUser } from "@/server/auth/session";
import { getUserApplication } from "@/server/recruitment-applications";
import { getAllEvents } from "@/lib/initiatives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join Us | CodeChef PESUECC",
  description:
    "Apply to join CodeChef PESUECC Chapter. Build real platforms, organize premier events, and level up together.",
};

/**
 * Tint for the "register first" callout.
 *
 * Set through the panel's own `--mecha-fill` rather than a `bg-*` utility on the
 * body. MechaPanel stacks an opaque `.mecha__body` over `.mecha__inline`, which
 * paints the *outline* colour — so a utility background replaces that opaque
 * fill and lets the light outline layer show through, which reads as a washed-out
 * cream card in dark mode. Overriding the variable keeps the fill opaque and
 * theme-aware, the same way `.mecha--ide` does it in globals.css.
 */
/**
 * Days until the drive closes, or null when there's no date (or it has passed).
 *
 * `closesOn` is a plain YYYY-MM-DD in IST, so both sides are pinned to UTC
 * midnight to compare whole days — using local time would make the countdown
 * tick over at a different moment for a student abroad than for the committee.
 * Safe on every request because the page is force-dynamic.
 */
function daysUntil(closesOn: string | null): number | null {
  if (!closesOn) return null;
  const end = Date.parse(`${closesOn}T00:00:00Z`);
  if (Number.isNaN(end)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((end - today) / 86_400_000);
  return days >= 0 ? days : null;
}

const CALLOUT_FILL = {
  "--mecha-fill": "color-mix(in oklab, var(--color-bronze) 10%, var(--color-panel))",
} as CSSProperties;

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
// Mirrors the homepage `metrics` array. Kept as a local copy rather than shared:
// the homepage sells the chapter to everyone, this sells it to someone deciding
// whether to apply, and the two will drift apart on purpose.
const proofStats = [
  { value: 50, suffix: "+", label: "Active members" },
  { value: 3, suffix: "+", label: "Platforms in production" },
  { value: 1500, prefix: "Rs ", suffix: "+", label: "Paid out monthly on the Arena" },
];

// First draft — rewrite these in the club's own voice before the drive opens.
// The point of the section is to answer the questions that otherwise arrive as
// Instagram DMs the week applications are live.
const faqs = [
  {
    q: "Do I need to already know DSA or how to code?",
    a: "No. Plenty of our members joined having never written a loop — that is what LeetCode 101 and the mentorship are for. We are looking for people who will keep showing up, not people who already know everything.",
  },
  {
    q: "Can first-years apply?",
    a: "Yes, and we want you to. Leave the SRN field blank on the form if yours has not been assigned yet — your PRN is enough.",
  },
  {
    q: "Can I apply to more than one domain?",
    a: "Yes — you can select up to 2 domains on the application form, and you will be asked domain-specific questions for each.",
  },
  {
    q: "How much time does this actually take?",
    a: "Three to five hours a week is typical, and it goes up around events. Tell us honestly on the form how much you can give; we would rather know than find out in November.",
  },
  {
    q: "I don't have an Arena account. Do I need one?",
    a: "Yes — applications are native to our platform, so you must register and sign in to submit your application. Registering takes about a minute.",
  },
  {
    q: "When will I hear back?",
    a: "We read every application. If you are shortlisted we will email you about what comes next, so keep an eye on your inbox and your spam folder.",
  },
];

const timeline = [
  {
    step: "01",
    title: "Apply",
    desc: "Fill in the form above and pick up to 2 domains you want to be considered for.",
  },
  {
    step: "02",
    title: "We read it",
    desc: "Every response is read by the team — there's no filter you have to get past first.",
  },
  {
    step: "03",
    title: "We get in touch",
    desc: "If you're shortlisted we'll reach out about what comes next. Check your spam folder too.",
  },
];

export default async function JoinPage() {
  const [settings, user] = await Promise.all([
    getRecruitmentSettings(),
    getCurrentUser(),
  ]);
  const cycle = settings.cycle?.trim();
  const existingApp = user ? await getUserApplication(user.id, cycle || "current") : null;
  const events = getAllEvents();
  const isOpen = settings.isOpen;
  const cycleBadge = cycle ? `Recruitment ${cycle}` : "Recruitment";
  const daysLeft = isOpen ? daysUntil(settings.closesOn) : null;

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
                  {daysLeft === 0
                    ? "Closes today"
                    : daysLeft === 1
                      ? "Closes tomorrow"
                      : daysLeft !== null
                        ? `${daysLeft} days left · closes ${settings.closesOn}`
                        : `Closes on ${settings.closesOn}`}
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
            {isOpen && (
              // Plain anchor, not AppLink: this is a same-page jump, and Lenis
              // scrolls natively underneath so the browser handles it. The form
              // sits at the bottom now, and someone who already decided to apply
              // shouldn't have to scroll past the whole pitch to reach it.
              <a
                href="#apply"
                className="mecha-btn mecha-btn--solid mt-8 inline-flex items-center gap-2 text-sm"
              >
                Apply now
                <span aria-hidden className="mecha-btn-arrow">
                  &darr;
                </span>
              </a>
            )}
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

      {/* Proof — the pitch above claims we ship things; this is the evidence */}
      <section className="border-t border-hairline bg-panel/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {proofStats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08}>
                <div className="text-center">
                  <p className="font-display text-4xl font-bold tracking-tight text-chocolate">
                    <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </p>
                  <p className="mt-1 text-sm text-charcoal/70">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-16 max-w-2xl">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
              What you&apos;d be working on
            </span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
              Things we actually run
            </h2>
            <p className="mt-3 text-pretty text-charcoal/70">
              Not hypothetical projects — these are live, and members build and run them.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((event, i) => (
              <Reveal key={event.id} delay={i * 0.05} className="h-full">
                <Link href={`/initiatives/${event.id}`} className="block h-full">
                  <MechaPanel
                    label={event.status}
                    className="h-full transition-transform duration-200 hover:-translate-y-1"
                    bodyClassName="p-5"
                  >
                    <h3 className="font-display text-base font-bold text-chocolate">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-charcoal/70">
                      {event.cardBrief}
                    </p>
                  </MechaPanel>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <p className="mt-8 text-sm text-charcoal/70">
              Curious who you&apos;d be working with?{" "}
              <Link href="/team" className="text-bronze underline-offset-4 hover:underline">
                Meet the team
              </Link>
              .
            </p>
          </Reveal>
        </div>
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

      {/* FAQ — answers the questions that otherwise arrive as DMs */}
      <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
            Questions
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-chocolate sm:text-4xl">
            Before you apply
          </h2>
        </Reveal>

        <div className="mt-10 space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.q} delay={i * 0.05}>
              <details className="group rounded-2xl border border-hairline bg-white/60 px-5 py-4 dark:bg-panel/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-chocolate">
                  {faq.q}
                  <span
                    aria-hidden
                    className="shrink-0 font-mono text-bronze transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-charcoal/70">{faq.a}</p>
              </details>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <p className="mt-8 text-center text-sm text-charcoal/70">
            Still unsure about something? Ask us on{" "}
            <a
              href="https://www.instagram.com/codechef_pesuecc/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bronze underline-offset-4 hover:underline"
            >
              Instagram
            </a>{" "}
            or email{" "}
            <a
              href="mailto:codechef.ecc@pes.edu"
              className="text-bronze underline-offset-4 hover:underline"
            >
              codechef.ecc@pes.edu
            </a>
            . No question is too basic.
          </p>
        </Reveal>
      </section>

      {/* Application form — last, after the case for applying has been made */}
      <section id="apply" className="mx-auto max-w-4xl scroll-mt-24 px-6 py-10 pb-24">
        {isOpen ? (
          <div className="space-y-8">
            {!user ? (
              /* Not signed in prompt */
              <Reveal>
                <MechaPanel
                  label="Application Gate"
                  index="Sign In Required"
                  style={CALLOUT_FILL}
                  bodyClassName="p-8 text-center space-y-4"
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
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-chocolate">
                      Sign in or Register to Apply
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-charcoal/75">
                      Recruitment applications are tied to your CodeChef PESUECC platform account. Create an account or sign in to complete your application.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Link
                      href="/register"
                      className="mecha-btn mecha-btn--solid text-xs inline-flex items-center gap-2"
                    >
                      Create Account &rarr;
                    </Link>
                    <Link
                      href="/login"
                      className="mecha-btn mecha-btn--ghost text-xs inline-flex items-center gap-2"
                    >
                      Sign in
                    </Link>
                  </div>
                </MechaPanel>
              </Reveal>
            ) : process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !user.emailVerified ? (
              /* Unverified email prompt */
              <Reveal>
                <MechaPanel
                  label="Verification Required"
                  index="Email OTP"
                  style={CALLOUT_FILL}
                  bodyClassName="p-8 text-center space-y-4"
                >
                  <h3 className="font-display text-2xl font-bold text-chocolate">
                    Verify your email address
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-charcoal/75">
                    Your account (<span className="font-mono font-medium text-chocolate">{user.email}</span>) needs to be verified before submitting a recruitment application.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/verify"
                      className="mecha-btn mecha-btn--solid text-xs inline-flex items-center gap-2"
                    >
                      Verify Email &rarr;
                    </Link>
                  </div>
                </MechaPanel>
              </Reveal>
            ) : (
              /* Native Recruitment Form */
              <Reveal delay={0.1}>
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-chocolate">
                        Application Form
                      </h2>
                      <p className="text-xs text-charcoal/70">
                        Select your domain(s) and submit your responses below.
                      </p>
                    </div>
                    {cycle && (
                      <span className="font-mono text-xs text-bronze uppercase tracking-wider self-start sm:self-auto">
                        {cycle} Drive
                      </span>
                    )}
                  </div>

                  <NativeRecruitmentForm
                    user={user}
                    existingApp={existingApp}
                    cycle={cycle || "2026-27"}
                    isOpen={isOpen}
                  />
                </div>
              </Reveal>
            )}
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
    </main>
  );
}
