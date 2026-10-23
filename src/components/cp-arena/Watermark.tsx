// Faint, tiled, diagonal identity watermark. Purely a deterrent: it can't stop
// an OS screenshot, but it makes a leaked capture traceable to the solver.
// `tag` should become the authenticated handle/SRN once identity lands.
export default function Watermark({ tag }: { tag: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden opacity-[0.07]"
    >
      <div className="absolute left-1/2 top-1/2 flex h-[170%] w-[170%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] flex-wrap content-center justify-center gap-x-12 gap-y-10">
        {Array.from({ length: 400 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-wider text-black dark:text-white"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
