import { toEmbedUrl, toShareUrl } from "@/lib/recruitment";

interface GoogleFormEmbedProps {
  formUrl: string;
}

/**
 * Server component embedding the Google Form inside a white card.
 *
 * The card is deliberate: a Google Form has one theme and always renders light,
 * so framing it as a white panel reads as intentional in dark mode instead of
 * looking like a broken patch.
 *
 * The prominent "open in a new tab" escape hatch above the frame is not
 * decoration. The form requires a Google sign-in (it limits one response per
 * account), and **Google refuses to serve its sign-in page inside an iframe** —
 * so a signed-out visitor hits a wall in the embed that they cannot get past
 * from inside it, no matter their browser. Opening the form in a real tab is
 * their only route, which makes that link a primary path rather than a fallback.
 * The quieter link below the frame covers a different failure: the frame not
 * loading at all, for anyone whose browser blocks third-party embeds outright.
 */
export default function GoogleFormEmbed({ formUrl }: GoogleFormEmbedProps) {
  const embedUrl = toEmbedUrl(formUrl);
  const shareUrl = toShareUrl(formUrl);

  return (
    <div className="w-full space-y-4">
      {/* Sign-in escape hatch — above the frame, because someone who hits the
          wall shouldn't have to scroll past a 760px box to find the way out. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-bronze/25 bg-bronze/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-charcoal/80">
          The form asks you to sign in to Google, and that can&apos;t load inside an
          embedded form.{" "}
          <span className="font-medium text-chocolate">
            If you see a sign-in screen below, open the form in a new tab instead.
          </span>
        </p>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mecha-btn mecha-btn--solid shrink-0 self-start text-xs sm:self-auto"
        >
          Open in a new tab &rarr;
        </a>
      </div>

      {/* Card container */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-hairline bg-white p-2 shadow-sm sm:p-4">
        <iframe
          src={embedUrl}
          title="Club recruitment application form"
          className="h-full min-h-[520px] w-full rounded-xl border-0 sm:min-h-[760px]"
        >
          Loading application form…
        </iframe>
      </div>

      {/* Quieter catch for a frame that never loaded at all */}
      <div className="flex items-center justify-center text-center">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-charcoal/70 transition-colors hover:text-bronze dark:text-cream/70 dark:hover:text-bronze"
        >
          <span>Form not loading? Open it in a new tab</span>
          <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  );
}
