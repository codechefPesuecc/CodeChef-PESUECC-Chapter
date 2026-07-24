import Reveal from "@/components/Reveal";

export function SectionIntro({
  eyebrow,
  title,
  body,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <Reveal className="max-w-2xl">
      <span className="font-mono text-sm font-bold uppercase tracking-wider text-bronze dark:text-bronze/90">
        {eyebrow}
      </span>
      <h2
        className={`mt-3 text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl ${
          dark ? "text-cream" : "text-chocolate dark:text-cream"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-3 text-pretty leading-7 ${
          dark ? "text-cream/62" : "text-charcoal/70"
        }`}
      >
        {body}
      </p>
    </Reveal>
  );
}

export function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-hairline bg-panel/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-charcoal/55">
      {label}: <span className="text-brown">{value}</span>
    </span>
  );
}

export function TechnicalBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-tech-grid-main opacity-50"
      />
      <div
        aria-hidden
        className="absolute right-0 top-24 h-72 w-72 rounded-full bg-bronze/10 blur-3xl"
      />
    </>
  );
}

export function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
