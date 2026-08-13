export default function Loading() {
  return (
    <main className="flex-1">
      <section className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.5))] dark:bg-[linear-gradient(180deg,rgba(19,14,10,0.88),rgba(19,14,10,0.68))]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <div className="rounded-[2rem] border border-white/20 bg-white/60 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-black/25 sm:p-8">
            <div className="space-y-4 animate-pulse">
              <div className="h-3 w-24 rounded-full bg-black/10 dark:bg-white/10" />
              <div className="h-12 w-full max-w-3xl rounded-3xl bg-black/10 dark:bg-white/10" />
              <div className="h-6 w-full max-w-2xl rounded-2xl bg-black/10 dark:bg-white/10" />
              <div className="h-12 w-full max-w-4xl rounded-full bg-black/10 dark:bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard featured />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    </main>
  );
}

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/60 shadow-[0_20px_70px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-white/10 dark:bg-black/25 ${featured ? "md:col-span-2 xl:col-span-2" : ""}`}>
      <div className={`aspect-[4/3] animate-pulse bg-black/10 dark:bg-white/10 ${featured ? "xl:aspect-[16/9]" : ""}`} />
      <div className="space-y-4 p-6 sm:p-7">
        <div className="h-3 w-24 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
        <div className={`h-8 rounded-2xl bg-black/10 animate-pulse dark:bg-white/10 ${featured ? "w-4/5" : "w-3/4"}`} />
        <div className="h-4 w-2/3 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
        <div className="space-y-2 pt-2">
          <div className="h-4 w-full rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
          <div className="h-4 w-11/12 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
          <div className="h-4 w-4/5 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-20 rounded-2xl bg-black/10 animate-pulse dark:bg-white/10" />
          <div className="h-20 rounded-2xl bg-black/10 animate-pulse dark:bg-white/10" />
        </div>
        <div className="h-5 w-28 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
      </div>
    </div>
  );
}