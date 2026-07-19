import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newsroom",
  description:
    "Announcements, event recaps, contest results, and stories from the CodeChef PESUECC Chapter.",
};

export default function NewsroomPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 sm:py-20">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-bronze">
        Newsroom
      </span>
      <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight text-chocolate sm:text-5xl">
        Latest from the chapter
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-lg leading-8 text-charcoal/80">
        Announcements, event recaps, contest results, and stories from the
        CodeChef PESUECC community.
      </p>

      <div className="mt-12 rounded-2xl border border-dashed border-hairline bg-panel/60 p-12 text-center">
        <p className="font-display text-lg font-semibold text-chocolate">
          No posts yet
        </p>
        <p className="mt-2 text-sm text-charcoal/60">
          The first stories are on the way — check back soon.
        </p>
      </div>
    </main>
  );
}
