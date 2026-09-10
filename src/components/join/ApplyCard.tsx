import MechaPanel from "@/components/cp-arena/MechaPanel";
import { toShareUrl } from "@/lib/recruitment";

interface ApplyCardProps {
  formUrl: string;
}

/**
 * The call to action that sends an applicant to the Google Form in a new tab.
 *
 * This replaced an inline iframe. The form limits one response per Google
 * account, which makes signing in mandatory — and Google refuses to serve its
 * sign-in page inside an iframe, so every signed-out visitor hit a wall in the
 * embed that they could not get past from inside it. Keeping the frame meant
 * most applicants would have had to notice a fallback link to get anywhere.
 *
 * A button that opens the real form is simply the path that works, so it is now
 * the only path offered. `toShareUrl` strips `embedded=true`, since that renders
 * the chrome-less variant and this opens a genuine tab.
 */
export default function ApplyCard({ formUrl }: ApplyCardProps) {
  return (
    <MechaPanel label="Apply" ticks bodyClassName="p-8 text-center sm:p-10">
      <h3 className="font-display text-2xl font-bold text-chocolate">
        Ready to apply?
      </h3>
      <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-charcoal/70">
        The form opens in a new tab. You&apos;ll be asked to sign in with Google — that
        is how we keep it to one application per person — and it takes about ten
        minutes.
      </p>

      <a
        href={toShareUrl(formUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="mecha-btn mecha-btn--solid mt-6 inline-flex items-center gap-2 text-sm"
      >
        Open the application form
        <span aria-hidden className="mecha-btn-arrow">
          &rarr;
        </span>
      </a>

      <p className="mt-4 text-xs text-charcoal/50">
        Have your Arena username to hand — the form asks for it.
      </p>
    </MechaPanel>
  );
}
