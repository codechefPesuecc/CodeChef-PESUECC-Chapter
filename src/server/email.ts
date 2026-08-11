/**
 * Provider-agnostic transactional email.
 *
 * With no provider key configured it uses the "console" transport — it logs the
 * message server-side instead of sending — so the whole OTP flow is testable in
 * dev without an external service. Set `RESEND_API_KEY` (and `EMAIL_FROM`) to
 * send for real; adding another provider (SES, Postmark, …) is one more branch
 * in `sendEmail`.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailTransport = "gmail" | "console";

export function emailTransport(): EmailTransport {
  return process.env.GMAIL_REFRESH_TOKEN ? "gmail" : "console";
}

/** True when emails are only logged instead of sent (no provider configured). */
export function isConsoleTransport(): boolean {
  return emailTransport() === "console";
}

/**
 * Whether it's safe to return a secret (a password-reset link or an OTP) in the
 * HTTP response, for local testing without an inbox. ONLY true in development
 * with the console transport — never in production, even if no email provider is
 * configured. This is the guard that stops reset links / codes from leaking to
 * an unauthenticated caller in a misconfigured prod deploy.
 */
export function canRevealSecretInResponse(): boolean {
  return isConsoleTransport() && process.env.NODE_ENV !== "production";
}

function encodeBase64Url(str: string): string {
  if (typeof btoa !== "undefined") {
    // Browser / Edge / Node polyfill
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Fallback for native Node if needed
  return Buffer.from(str, "utf-8").toString("base64url");
}

async function getGmailAccessToken(): Promise<string | null> {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID || "",
    client_secret: process.env.GMAIL_CLIENT_SECRET || "",
    refresh_token: process.env.GMAIL_REFRESH_TOKEN || "",
    grant_type: "refresh_token",
  });

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error("[email] Failed to refresh Gmail token:", res.status, await res.text());
      return null;
    }

    const data = await res.json() as { access_token: string };
    return data.access_token;
  } catch (err) {
    console.error("[email] Error refreshing Gmail token:", err);
    return null;
  }
}

export async function sendEmail(
  msg: EmailMessage,
): Promise<{ ok: boolean; error?: string }> {
  if (emailTransport() === "gmail") {
    try {
      const accessToken = await getGmailAccessToken();
      if (!accessToken) {
        return { ok: false, error: "Authentication with email provider failed." };
      }

      const from = process.env.EMAIL_FROM ?? "CodeChef PESUECC <noreply@gmail.com>";
      const emailLines = [
        `From: ${from}`,
        `To: ${msg.to}`,
        `Subject: =?utf-8?B?${encodeBase64Url(msg.subject)}?=`,
        "MIME-Version: 1.0",
        msg.html ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
        "",
        msg.html || msg.text,
      ];
      const rawEmail = emailLines.join("\r\n");
      const base64UrlEmail = encodeBase64Url(rawEmail);

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64UrlEmail }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[email] gmail api failed:", res.status, detail);
        return { ok: false, error: `Email provider returned ${res.status}.` };
      }
      return { ok: true };
    } catch (e) {
      console.error("[email] gmail api error:", e);
      return { ok: false, error: "Could not reach the email provider." };
    }
  }

  // console transport (dev): log instead of send.
  console.log(
    `\n[email:dev] To: ${msg.to}\n[email:dev] Subject: ${msg.subject}\n[email:dev] ${msg.text}\n`,
  );
  return { ok: true };
}
