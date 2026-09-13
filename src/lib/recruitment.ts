/**
 * Google Forms URL handling for the recruitment drive.
 *
 * The form URL is entered by an admin at /admin/recruitment and becomes the
 * destination of a link on /join, so it is validated on the way in rather than
 * trusted: `isGoogleFormUrl` rejects anything that isn't an https Google Forms
 * URL at write time (src/server/recruitment.ts) and again at render time. That
 * matters even for a plain link — an unchecked value here would let an admin
 * account, or a mistake, point applicants anywhere.
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
 * Adds `embedded=true`, which is how Google serves the chrome-less variant of a
 * form.
 *
 * NOTE: nothing in the app calls this any more — /join links out to the form in
 * a new tab rather than framing it, because Google will not serve its sign-in
 * page inside an iframe and the form requires a sign-in. Kept, with its tests,
 * because it is the documented inverse of `toShareUrl` (which is very much still
 * used, since admins do paste the `<>` embed URL) and because reinstating an
 * embed would otherwise mean rewriting and re-testing this from scratch. Delete
 * it if that stops being plausible.
 *
 * Returns the input untouched if it can't be parsed — callers gate on
 * `isGoogleFormUrl` first.
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
