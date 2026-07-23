/**
 * Faint HUD registration brackets at the four viewport corners — the "cockpit
 * frame" around the whole app. Purely decorative and non-interactive; hidden on
 * small screens where it would crowd the UI.
 */
export default function HudFrame() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 hidden md:block"
    >
      <span className="absolute left-2.5 top-2.5 h-4 w-4 border-l-2 border-t-2 border-bronze/30" />
      <span className="absolute right-2.5 top-2.5 h-4 w-4 border-r-2 border-t-2 border-bronze/30" />
      <span className="absolute bottom-2.5 left-2.5 h-4 w-4 border-b-2 border-l-2 border-bronze/30" />
      <span className="absolute bottom-2.5 right-2.5 h-4 w-4 border-b-2 border-r-2 border-bronze/30" />
    </div>
  );
}
