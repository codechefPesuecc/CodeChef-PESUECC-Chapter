import { toEmbedUrl, toShareUrl } from "@/lib/recruitment";

interface GoogleFormEmbedProps {
  formUrl: string;
}

/**
 * Server component embedding the Google Form inside a responsive, theme-aware card.
 *
 * Google Forms has an un-themeable white background. Wrapping it in a clean white
 * card ensures it appears as an intentional element in dark mode rather than a jarring
 * visual glitch.
 *
 * An escape hatch link is provided below the frame for users whose privacy extensions
 * or browsers block third-party iframe embeds.
 */
export default function GoogleFormEmbed({ formUrl }: GoogleFormEmbedProps) {
  const embedUrl = toEmbedUrl(formUrl);
  const shareUrl = toShareUrl(formUrl);

  return (
    <div className="w-full space-y-4">
      {/* Card container */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-hairline bg-white p-2 shadow-sm sm:p-4">
        <iframe
          src={embedUrl}
          title="Club recruitment application form"
          className="h-full min-h-[75vh] w-full rounded-xl border-0 sm:min-h-[1200px]"
        >
          Loading application form…
        </iframe>
      </div>

      {/* Fallback link */}
      <div className="flex items-center justify-center text-center">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-charcoal/70 transition-colors hover:text-bronze dark:text-cream/70 dark:hover:text-bronze"
        >
          <span>Trouble loading the form? Open it in a new tab</span>
          <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  );
}
