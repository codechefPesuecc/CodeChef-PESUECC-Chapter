import Image from "next/image";
import Link from "next/link";

const explore = [
  { href: "/", label: "Home" },
  { href: "/cp-arena", label: "Arena" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/team", label: "Team" },
  { href: "/newsroom", label: "Newsroom" },
];

const initiatives = [
  { href: "/initiatives", label: "LeetCode 101" },
  { href: "/initiatives", label: "AlgoHunt" },
  { href: "/initiatives", label: "Praxis Hackathon" },
  { href: "/initiatives", label: "Eclipse" },
  { href: "/initiatives", label: "AlgoHunt Base" },
];

const socials = [
  { label: "GitHub", href: "https://github.com/codechefPesuecc", icon: <GitHubIcon /> },
  {
    label: "Instagram",
    href: "https://www.instagram.com/codechef_pesuecc/",
    icon: <InstagramIcon />,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/codechef-pesuecc/",
    icon: <LinkedInIcon />,
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden bg-chocolate text-cream/80 dark:bg-[#0f0b07]">
      {/* Depth: vertical gradient + soft bronze glow at the top edge */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-chocolate to-[#2a1f18] dark:from-[#0f0b07] dark:to-[#181109]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-bronze/10 to-transparent"
      />
      {/* Oversized watermark wordmark */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display text-[15vw] font-bold leading-none tracking-tight text-cream/[0.05]"
      >
        CODECHEF
      </span>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-[1.6fr_1fr_1.3fr_1.4fr]">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
                <Image
                  src="/logo.svg"
                  alt="CodeChef PESU ECC Chapter"
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 object-contain"
                />
              </span>
              <div>
                <p className="font-display text-base font-bold text-cream">
                  CodeChef <span className="text-bronze">·</span> PESUECC
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bronze/90">
                  Chapter
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-6 text-cream/60">
              Building a campus competitive programming culture at PES University,
              ECC — a daily arena, technical initiatives, and platforms
              engineered in the open.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="text-base font-semibold text-cream">Explore</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {explore.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-cream/60 transition-colors hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Initiatives */}
          <div>
            <h3 className="text-base font-semibold text-cream">Initiatives</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {initiatives.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-cream/60 transition-colors hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get in Touch */}
          <div>
            <h3 className="text-base font-semibold text-cream">Get in Touch</h3>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-bronze">
                  <MailIcon />
                </span>
                <a
                  href="mailto:codechef@pesu.pes.edu"
                  className="text-cream/70 transition-colors hover:text-cream"
                >
                  codechef@pesu.pes.edu
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-bronze">
                  <PinIcon />
                </span>
                <span className="text-cream/70">
                  PES University, Electronic City Campus,
                  <br />
                  Hosur Road, Bengaluru 560100
                </span>
              </li>
            </ul>

            <div className="mt-6 flex gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 text-cream/70 transition-colors hover:border-bronze hover:bg-cream/5 hover:text-cream"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-cream/10 pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs text-cream/50">
              © {year} CodeChef PESUECC Chapter. All rights reserved.
            </p>
            <p className="font-display text-sm font-semibold text-cream/70">
              Built in the open.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* --- Icons --- */

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.94c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.83 0c2.22-1.49 3.2-1.18 3.2-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.73v20.53C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.73C24 .78 23.2 0 22.22 0z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
