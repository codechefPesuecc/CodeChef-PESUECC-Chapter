/**
 * Cloudflare Turnstile verification for submissions. Dormant until
 * TURNSTILE_SECRET_KEY is set — with no key, `verifyTurnstile` passes and no
 * challenge is required (the client widget is likewise hidden). Set the secret
 * here and NEXT_PUBLIC_TURNSTILE_SITE_KEY on the client to enable.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!turnstileEnabled()) return { ok: true };
  if (!token) return { ok: false, error: "Complete the verification challenge." };

  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY as string,
        response: token,
        remoteip: ip,
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success
      ? { ok: true }
      : { ok: false, error: "Verification failed — please try again." };
  } catch {
    return { ok: false, error: "Couldn't reach the verification service." };
  }
}
