"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/auth/useUser";

export default function VerifyForm() {
  const user = useUser();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const sentRef = useRef(false);

  const send = useCallback(async (initial: boolean) => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // On the initial auto-send, a cooldown just means a code is already out.
        if (initial && res.status === 429) {
          setInfo("A code is on its way — check your inbox.");
        } else {
          setError(data.error ?? "Couldn't send a code.");
        }
        return;
      }
      setInfo("We sent a 6-digit code to your email.");
      if (data.devCode) setDevCode(data.devCode);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSending(false);
    }
  }, []);

  // Send the first code once, as soon as we know the user is unverified.
  useEffect(() => {
    if (!user || user.emailVerified || sentRef.current) return;
    sentRef.current = true;
    void send(true);
  }, [user, send]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Verification failed.");
        setVerifying(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        window.location.href = "/cp-arena";
      }, 1200);
    } catch {
      setError("Couldn't reach the server.");
      setVerifying(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-hairline bg-panel p-8 shadow-sm">
        {user === undefined ? (
          <p className="text-sm text-charcoal/60">Loading…</p>
        ) : user === null ? (
          <>
            <h1 className="font-display text-2xl font-bold text-chocolate">
              Verify your email
            </h1>
            <p className="mt-2 text-sm text-charcoal/70">
              Please log in first to verify your email.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90"
            >
              Log in
            </Link>
          </>
        ) : user.emailVerified ? (
          <>
            <h1 className="font-display text-2xl font-bold text-chocolate">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-charcoal/70">
              Your email is verified — you&apos;re all set.
            </p>
            <Link
              href="/cp-arena"
              className="mt-5 inline-block rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90"
            >
              Go to the Arena →
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              Verified!
            </h1>
            <p className="mt-2 text-sm text-charcoal/70">
              Taking you to the Arena…
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-chocolate">
              Verify your email
            </h1>
            <p className="mt-1 text-sm text-charcoal/60">
              Enter the 6-digit code sent to{" "}
              <span className="font-semibold text-brown">{user.email}</span>.
            </p>

            {devCode && (
              <p className="mt-3 rounded-lg border border-dashed border-bronze/40 bg-bronze/5 px-3 py-2 text-xs text-charcoal/70">
                Dev mode — your code is{" "}
                <span className="font-mono font-bold text-bronze">{devCode}</span>
              </p>
            )}

            <form onSubmit={verify} className="mt-6 space-y-4">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="w-full rounded-lg border border-hairline bg-cream/40 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] text-charcoal outline-none transition-colors focus:border-bronze dark:bg-white/[0.03]"
                required
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {info && !error && (
                <p className="text-sm text-charcoal/60">{info}</p>
              )}
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full rounded-lg bg-bronze px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bronze/90 disabled:opacity-60"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => send(false)}
              disabled={sending}
              className="mt-4 text-sm font-medium text-bronze hover:underline disabled:opacity-60"
            >
              {sending ? "Sending…" : "Resend code"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
