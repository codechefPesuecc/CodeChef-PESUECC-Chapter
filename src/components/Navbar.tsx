"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/components/auth/useUser";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/cp-arena", label: "Arena" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/team", label: "Team" },
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

  // The active theme lives entirely in the `.dark` class on <html>.
  // We use the View Transitions API to create a seamless pan effect across the screen.
  const toggleTheme = (event: React.MouseEvent) => {
    const isDark = document.documentElement.classList.contains("dark");
    
    // Fallback if browser doesn't support startViewTransition
    if (!document.startViewTransition) {
      document.documentElement.classList.toggle("dark");
      try { localStorage.setItem("theme", !isDark ? "dark" : "light"); } catch {}
      return;
    }

    // Calculate the center of the toggle button to use as the animation origin.
    // This is much more robust than event.clientX/Y which can break on external
    // monitors with different scale factors, or when the button is triggered via keyboard.
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      document.documentElement.classList.toggle("dark");
      try { localStorage.setItem("theme", !isDark ? "dark" : "light"); } catch {}
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
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
          <ThemeToggle onToggle={toggleTheme} />

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                title={`@${user.username} · your profile`}
                aria-label="Your profile"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-bronze/10 text-sm font-bold uppercase text-bronze shadow-sm transition-shadow hover:shadow-md"
              >
                {user.username.charAt(0).toUpperCase()}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="mecha-btn mecha-btn--ghost"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-chocolate ring-1 ring-bronze/50 shadow-sm transition-shadow hover:shadow-md dark:bg-[#241a12] dark:text-cream dark:shadow-[0_4px_20px_-2px_rgba(166,124,82,0.55)] dark:hover:shadow-[0_6px_28px_0_rgba(166,124,82,0.75)]"
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


