"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/components/auth/useUser";

const links = [
  { href: "/", label: "Home" },
  { href: "/cp-arena", label: "Arena" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/team", label: "Team" },
  { href: "/newsroom", label: "Newsroom" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const user = useUser();

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The active theme lives entirely in the `.dark` class on <html> (set pre-paint
  // by the inline script in the layout). Read and flip it straight on the DOM so
  // there is no React state to hydrate — the sun/moon icons are shown via CSS.
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-hairline bg-cream/80 backdrop-blur-md dark:bg-[#140f0a]/85"
          : "border-b border-transparent"
      }`}
    >
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-white shadow-sm">
            <Image
              src="/logo.svg"
              alt="CodeChef PESU ECC Chapter"
              width={36}
              height={36}
              priority
              unoptimized
              className="h-9 w-9 object-contain"
            />
          </span>
          <span className="hidden font-display leading-none sm:flex sm:flex-col">
            <span className="text-lg font-bold tracking-tight text-chocolate">
              CodeChef
            </span>
            <span className="mt-0.5 text-xs font-semibold tracking-[0.2em] text-bronze">
              PESUECC Chapter
            </span>
          </span>
        </Link>

        {/* Centered floating pill (desktop) */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-hairline bg-white/70 p-1.5 shadow-sm backdrop-blur md:flex dark:bg-panel/70">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-bronze/15 font-semibold text-chocolate"
                  : "font-medium text-charcoal/70 hover:text-chocolate"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/70 text-chocolate shadow-sm backdrop-blur transition-colors hover:text-bronze dark:bg-panel/70"
          >
            {/* Icon reflects the theme purely via CSS: moon in light, sun in dark. */}
            <MoonIcon className="dark:hidden" />
            <SunIcon className="hidden dark:block" />
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                title={`@${user.username} · your profile`}
                className="hidden max-w-[10rem] truncate rounded-full bg-bronze/10 px-3.5 py-2 text-sm font-semibold text-bronze sm:block"
              >
                @{user.username}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-hairline bg-white/70 px-4 py-2 text-sm font-medium text-chocolate shadow-sm backdrop-blur transition-colors hover:text-bronze dark:bg-panel/70"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-chocolate px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_4px_20px_-2px_rgba(166,124,82,0.55)] ring-1 ring-bronze/50 transition-shadow hover:shadow-[0_6px_28px_0_rgba(166,124,82,0.75)] dark:bg-[#241a12]"
            >
              Log in
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/70 text-chocolate shadow-sm backdrop-blur md:hidden dark:bg-panel/70"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {open ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="mx-auto max-w-6xl px-6 md:hidden">
          <nav className="flex flex-col gap-1 rounded-2xl border border-hairline bg-white/90 p-2 shadow-lg backdrop-blur dark:bg-panel/95">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-bronze/15 font-semibold text-chocolate"
                    : "font-medium text-charcoal/80 hover:bg-black/5 dark:hover:bg-cream/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/* --- Theme toggle icons --- */

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
