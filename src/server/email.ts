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

export type EmailTransport = "resend" | "console";

export function emailTransport(): EmailTransport {
  return process.env.RESEND_API_KEY ? "resend" : "console";
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

export async function sendEmail(
  msg: EmailMessage,
): Promise<{ ok: boolean; error?: string }> {
  if (emailTransport() === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Arena <onboarding@resend.dev>",
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[email] resend failed:", res.status, detail);
        return { ok: false, error: `Email provider returned ${res.status}.` };
      }
      return { ok: true };
    } catch (e) {
      console.error("[email] resend error:", e);
      return { ok: false, error: "Could not reach the email provider." };
    }
  }

  // console transport (dev): log instead of send.
  console.log(
    `\n[email:dev] To: ${msg.to}\n[email:dev] Subject: ${msg.subject}\n[email:dev] ${msg.text}\n`,
  );
  return { ok: true };
}
