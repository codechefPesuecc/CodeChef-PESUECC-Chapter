"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/cp-arena", label: "CP Arena" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/team", label: "Team" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
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
          <span className="hidden font-display text-lg font-bold tracking-tight text-chocolate sm:inline">
            CodeChef <span className="text-bronze">·</span> PESUECC
          </span>
        </Link>

        {/* Centered floating pill (desktop) */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-hairline bg-white/70 p-1.5 shadow-sm backdrop-blur md:flex">
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
          <Link
            href="/cp-arena"
            className="rounded-full bg-chocolate px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_4px_20px_-2px_rgba(166,124,82,0.55)] ring-1 ring-bronze/50 transition-shadow hover:shadow-[0_6px_28px_0_rgba(166,124,82,0.75)]"
          >
            Enter Arena
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/70 text-chocolate shadow-sm backdrop-blur md:hidden"
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
          <nav className="flex flex-col gap-1 rounded-2xl border border-hairline bg-white/90 p-2 shadow-lg backdrop-blur">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-bronze/15 font-semibold text-chocolate"
                    : "font-medium text-charcoal/80 hover:bg-black/5"
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
