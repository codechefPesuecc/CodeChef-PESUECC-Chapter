/**
 * Google Forms URL handling for the recruitment drive.
 *
 * The form URL is entered by an admin at /admin/recruitment and ends up in an
 * iframe `src` on /join, so it gets validated on the way in rather than trusted.
 * Three layers guard that frame, and this module is the first:
 *
 *   1. `isGoogleFormUrl` — rejects anything that isn't an https Google Forms URL
 *      at write time (src/server/recruitment.ts) and again at render time.
 *   2. The `frame-src` allow-list in next.config.ts, which pins the frame to
 *      docs.google.com no matter what is stored.
 *   3. The iframe carries no `sandbox` relaxations of our own.
 *
 * Pure string/URL logic only — no DB, no React — so it can be unit tested and
 * imported from both server and client code.
 */

/** The only host a recruitment form may be served from. */
const FORMS_HOST = "docs.google.com";

/**
 * True for an https://docs.google.com/forms/... URL, false for everything else.
 *
 * Uses the URL parser rather than a regex so the usual lookalikes fail on the
 * host comparison: `https://docs.google.com.evil.test/forms/` parses to the host
 * `docs.google.com.evil.test`, and `https://docs.google.com@evil.test/forms/`
 * parses to `evil.test`. A `javascript:` payload fails the protocol check.
 */
export function isGoogleFormUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === FORMS_HOST &&
    url.pathname.startsWith("/forms/")
  );
}

/**
 * The URL to put in the iframe. Google serves a chrome-less form when
 * `embedded=true` is present, so admins can paste either the plain "viewform"
 * link or the one from the `<>` embed dialog and get the same result.
 *
 * Returns the input untouched if it can't be parsed — callers gate on
 * `isGoogleFormUrl` first, and silently swallowing a bad value here would hide
 * the reason the frame is empty.
 */
export function toEmbedUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.searchParams.set("embedded", "true");
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * The inverse: the URL for the "open in a new tab" fallback link under the
 * frame. `embedded=true` in a real tab renders the form without its header, so
 * it's stripped for anyone whose browser blocked the iframe.
 */
export function toShareUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.searchParams.delete("embedded");
    return url.toString();
  } catch {
    return value;
  }
}
