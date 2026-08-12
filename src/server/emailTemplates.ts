/**
 * Branded HTML email templates for the CodeChef PESUECC Arena. Table-based
 * layout + inline styles for broad client support (Gmail, Outlook, Apple Mail).
 * The logo loads by absolute URL from the deployed site; the layout is branded
 * with the palette even if images are blocked, and every email also carries a
 * plain-text alternative (see server/email.ts) so it renders anywhere.
 */

// Deployed origin — update if the site moves to a custom domain.
const SITE_ORIGIN = "https://codechef.pesuecc.workers.dev";
const LOGO_URL = `${SITE_ORIGIN}/icon.png`;

// Brand palette (see README).
const CREAM = "#F5F1EB";
const WHITE = "#FFFFFF";
const CHOCOLATE = "#3E2F24";
const BROWN = "#5B4638";
const BRONZE = "#A67C52";
const CHARCOAL = "#1F1F1F";
const HAIRLINE = "#E7DFD3";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wraps content in the branded shell: logo header, white card, footer. */
function shell(inner: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
        <tr><td align="center" style="padding-bottom:18px;">
          <img src="${LOGO_URL}" alt="CodeChef PESUECC Chapter" width="76" height="76" style="display:block;border:0;outline:none;">
        </td></tr>
        <tr><td style="background:${WHITE};border:1px solid ${HAIRLINE};border-radius:16px;padding:32px 28px;">
          ${inner}
        </td></tr>
        <tr><td align="center" style="padding:18px 8px 0;color:${BROWN};font-size:12px;line-height:1.6;">
          <strong style="color:${CHOCOLATE};letter-spacing:0.02em;">CodeChef&nbsp;PESUECC Chapter</strong><br>
          The daily competitive programming arena.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Verification-code email. */
export function otpEmailHtml(code: string): string {
  const inner = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${CHOCOLATE};">Verify your email</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${CHARCOAL};">
      Enter this code in the Arena to finish setting up your account. It expires in <strong>10&nbsp;minutes</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="background:${CREAM};border:1px solid ${HAIRLINE};border-radius:12px;padding:20px;">
        <div style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${BRONZE};">${escapeHtml(code)}</div>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BROWN};">
      If you didn&rsquo;t request this, you can safely ignore this email.
    </p>`;
  return shell(inner, `Your Arena verification code is ${code}`);
}

/** Password-reset email with a button + fallback link. */
export function resetEmailHtml(link: string): string {
  const safe = escapeHtml(link);
  const inner = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${CHOCOLATE};">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${CHARCOAL};">
      Click the button below to choose a new password. This link is valid for <strong>30&nbsp;minutes</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:4px 0 8px;">
        <a href="${safe}" style="display:inline-block;background:${BRONZE};color:${WHITE};text-decoration:none;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;">Reset password</a>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${BROWN};word-break:break-all;">
      Or paste this link into your browser:<br>
      <a href="${safe}" style="color:${BRONZE};">${safe}</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${BROWN};">
      If you didn&rsquo;t request this, you can safely ignore this email &mdash; your password won&rsquo;t change.
    </p>`;
  return shell(inner, "Reset your Arena password");
}
